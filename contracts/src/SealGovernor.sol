// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SepoliaZamaFHEVMConfig } from "fhevm/config/ZamaFHEVMConfig.sol";
import { SepoliaZamaGatewayConfig } from "fhevm/config/ZamaGatewayConfig.sol";
import { GatewayCaller } from "fhevm/gateway/GatewayCaller.sol";
import { Gateway } from "fhevm/gateway/lib/Gateway.sol";
import { TFHE, euint8, euint128, ebool, einput } from "fhevm/lib/TFHE.sol";
import { SealTally } from "./SealTally.sol";
import { SealToken } from "./SealToken.sol";

contract SealGovernor is
    SepoliaZamaFHEVMConfig,
    SepoliaZamaGatewayConfig,
    GatewayCaller
{
    // ─── Constants ───────────────────────────────────────────────────────

    uint256 public constant VOTING_PERIOD   = 3 days;
    uint256 public constant VOTING_DELAY    = 1 days;   // delay before voting opens
    uint256 public constant PROPOSAL_THRESHOLD = 100e18; // min tokens to propose
    uint256 public constant QUORUM_BPS      = 400;      // 4% of total supply

    // ─── Structs ─────────────────────────────────────────────────────────

    struct Proposal {
        uint256 id;
        address proposer;
        string  description;
        address target;          // contract to call if proposal passes
        bytes   callData;        // function call to execute
        uint256 voteStart;       // block.timestamp when voting opens
        uint256 voteEnd;         // block.timestamp when voting closes
        ProposalState state;
        uint256 forVotes;        // revealed ONLY after close via Gateway
        uint256 againstVotes;    // revealed ONLY after close via Gateway
        uint256 abstainVotes;    // revealed ONLY after close via Gateway
        bool    tallyRequested;
        bool    executed;
    }

    enum ProposalState {
        PENDING,    // created, voting not yet open
        ACTIVE,     // voting open — tallies sealed
        TALLYING,   // voting closed, awaiting Gateway decryption
        SUCCEEDED,  // tally revealed, quorum + majority met
        DEFEATED,   // tally revealed, quorum or majority not met
        EXECUTED    // proposal executed on-chain
    }

    // ─── State ───────────────────────────────────────────────────────────

    SealToken public token;
    SealTally public tally;
    address public admin;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ─── Events ──────────────────────────────────────────────────────────

    // No vote amounts in events — sealed during voting period
    event ProposalCreated(uint256 indexed proposalId, address proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter);
    // Tally revealed only at close:
    event TallyRevealed(uint256 indexed proposalId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalDefeated(uint256 indexed proposalId);

    // ─── Errors ──────────────────────────────────────────────────────────

    error AlreadyVoted();
    error VotingNotActive();
    error VotingStillActive();
    error InsufficientTokens();
    error ProposalNotSucceeded();
    error TallyAlreadyRequested();

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(address _token, address _tally) {
        token = SealToken(_token);
        tally = SealTally(_tally);
        admin = msg.sender;
    }

    function setTally(address _tally) external {
        require(msg.sender == admin, "Only admin can set tally");
        tally = SealTally(_tally);
    }

    // ─── Create Proposal ─────────────────────────────────────────────────

    function propose(
        string calldata description,
        address target,
        bytes calldata callData
    ) external returns (uint256 proposalId) {
        // Proposer must hold enough tokens
        // Token balance is encrypted — we use a plaintext snapshot
        // (token.getPastVotes uses standard ERC20Votes snapshot mechanism)
        require(
            token.getPastVotes(msg.sender, block.number - 1) >= PROPOSAL_THRESHOLD,
            InsufficientTokens()
        );

        proposalId = ++proposalCount;

        proposals[proposalId] = Proposal({
            id:             proposalId,
            proposer:       msg.sender,
            description:    description,
            target:         target,
            callData:       callData,
            voteStart:      block.timestamp + VOTING_DELAY,
            voteEnd:        block.timestamp + VOTING_DELAY + VOTING_PERIOD,
            state:          ProposalState.PENDING,
            forVotes:       0,   // 0 until revealed
            againstVotes:   0,   // 0 until revealed
            abstainVotes:   0,   // 0 until revealed
            tallyRequested: false,
            executed:       false
        });

        // Initialise encrypted tallies in SealTally
        tally.initTally(proposalId);

        emit ProposalCreated(proposalId, msg.sender, description);
        return proposalId;
    }

    // ─── Cast Vote ────────────────────────────────────────────────────────

    /**
     * @notice Cast an encrypted vote on a proposal.
     * @param proposalId   The proposal to vote on
     * @param encVote      Encrypted vote direction (0=AGAINST, 1=FOR, 2=ABSTAIN)
     * @param proof        ZK proof for encVote
     *
     * @dev The vote direction is encrypted. The weight (token balance) is
     *      a plaintext snapshot — token balances are tracked via ERC20Votes.
     *      This is an honest trade-off: the AMOUNT of voting power is public
     *      (visible via token balance), but HOW the voter voted is encrypted.
     *      Neither the direction nor the running tally is visible until close.
     *
     *      This eliminates:
     *      - Last-minute coordination (can't see tally trend)
     *      - Vote buying verification (can't confirm direction)
     *      - Strategic signalling (can't see who voted which way)
     */
    function castVote(
        uint256 proposalId,
        einput encVote,
        bytes calldata proof
    ) external {
        Proposal storage prop = proposals[proposalId];

        require(
            block.timestamp >= prop.voteStart &&
            block.timestamp <= prop.voteEnd,
            VotingNotActive()
        );
        require(!hasVoted[proposalId][msg.sender], AlreadyVoted());

        // Voting weight from token snapshot (plaintext — this is intentional)
        uint256 weight = token.getPastVotes(msg.sender, prop.voteStart);
        require(weight > 0, InsufficientTokens());

        // Verify and decrypt user's encrypted vote direction
        euint8 vote = TFHE.asEuint8(encVote, proof);

        // Accumulate into encrypted tallies
        tally.castVote(proposalId, vote, weight);

        hasVoted[proposalId][msg.sender] = true;

        // Update state if still PENDING
        if (prop.state == ProposalState.PENDING) {
            prop.state = ProposalState.ACTIVE;
        }

        emit VoteCast(proposalId, msg.sender);
        // Note: no vote direction or weight in event — sealed
    }

    // ─── Request Tally Decryption ─────────────────────────────────────────

    /**
     * @notice Request Gateway to decrypt the final tally.
     *         Can only be called after voting period ends.
     *         Anyone can call this — permissionless close.
     */
    function requestTally(uint256 proposalId) external {
        Proposal storage prop = proposals[proposalId];
        require(block.timestamp > prop.voteEnd, VotingStillActive());
        require(!prop.tallyRequested, TallyAlreadyRequested());

        prop.state = ProposalState.TALLYING;
        prop.tallyRequested = true;

        tally.requestDecryption(proposalId, this.fulfillTally.selector);
    }

    // ─── Gateway Callback ─────────────────────────────────────────────────

    /**
     * @notice Called by Zama Gateway after tally decryption completes.
     *         This is the ONLY moment tallies become public.
     */
    function fulfillTally(
        uint256 requestId,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes
    ) external onlyGateway {
        uint256 proposalId = tally.getProposalForRequest(requestId);
        Proposal storage prop = proposals[proposalId];

        prop.forVotes     = forVotes;
        prop.againstVotes = againstVotes;
        prop.abstainVotes = abstainVotes;

        // Determine outcome
        uint256 totalSupply = token.totalSupply();
        uint256 quorum = (totalSupply * QUORUM_BPS) / 10000;
        uint256 totalVotes = forVotes + againstVotes + abstainVotes;

        bool quorumMet  = totalVotes >= quorum;
        bool majorityFor = forVotes > againstVotes;

        if (quorumMet && majorityFor) {
            prop.state = ProposalState.SUCCEEDED;
        } else {
            prop.state = ProposalState.DEFEATED;
            emit ProposalDefeated(proposalId);
        }

        // Tally is now public — emit the revealed numbers
        emit TallyRevealed(proposalId, forVotes, againstVotes, abstainVotes);
    }

    // ─── Execute ─────────────────────────────────────────────────────────

    /**
     * @notice Execute a succeeded proposal.
     *         Calls the target contract with the stored calldata.
     */
    function execute(uint256 proposalId) external {
        Proposal storage prop = proposals[proposalId];
        require(prop.state == ProposalState.SUCCEEDED, ProposalNotSucceeded());
        require(!prop.executed, "Already executed");

        prop.state = ProposalState.EXECUTED;
        prop.executed = true;

        (bool success,) = prop.target.call(prop.callData);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId);
    }

    // ─── View ─────────────────────────────────────────────────────────────

    /**
     * @notice Get proposal state and metadata.
     *         During ACTIVE state: forVotes/againstVotes/abstainVotes = 0
     *         (not revealed). After TALLYING completes: real values shown.
     */
    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory description,
        uint256 voteStart,
        uint256 voteEnd,
        ProposalState state,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes
    ) {
        Proposal storage prop = proposals[proposalId];
        return (
            prop.proposer,
            prop.description,
            prop.voteStart,
            prop.voteEnd,
            prop.state,
            prop.forVotes,     // 0 during ACTIVE — sealed
            prop.againstVotes, // 0 during ACTIVE — sealed
            prop.abstainVotes  // 0 during ACTIVE — sealed
        );
    }

    function getVoterStatus(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
        // Returns whether voter has voted — not HOW they voted
    }

}
