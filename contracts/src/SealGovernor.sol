// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { GatewayCaller } from "./fhevm/gateway/GatewayCaller.sol";
import { Gateway } from "./fhevm/gateway/lib/Gateway.sol";
import { TFHE, euint8, euint128, ebool, einput } from "./fhevm/lib/TFHE.sol";
import { SealTally } from "./SealTally.sol";
import { SealToken } from "./SealToken.sol";

contract SealGovernor is GatewayCaller {
    // ─── Constants ───────────────────────────────────────────────────────
    uint256 public constant VOTING_PERIOD   = 3 days;
    uint256 public constant VOTING_DELAY    = 1 days;
    uint256 public constant PROPOSAL_THRESHOLD = 100e18;
    uint256 public constant QUORUM_BPS      = 400;

    // ─── Structs ─────────────────────────────────────────────────────────
    struct Proposal {
        uint256 id;
        address proposer;
        string  description;
        address target;
        bytes   callData;
        uint256 voteStart; // Timestamp for when voting opens
        uint256 voteEnd;   // Timestamp for when voting closes
        uint256 snapshotBlock; // Block number for calculating voting power
        ProposalState state;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool    tallyRequested;
        bool    executed;
    }

    enum ProposalState { PENDING, ACTIVE, TALLYING, SUCCEEDED, DEFEATED, EXECUTED }

    // ─── State ───────────────────────────────────────────────────────────
    SealToken public token;
    SealTally public tally;
    address public admin;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ─── Events ──────────────────────────────────────────────────────────
    event ProposalCreated(uint256 indexed proposalId, address proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter);
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
    function propose(string calldata description, address target, bytes calldata callData) external returns (uint256 proposalId) {
        // FIX: Ask the token for balance at the previous block, playing nicely with its default clock
        require(token.getPastVotes(msg.sender, block.number - 1) >= PROPOSAL_THRESHOLD, InsufficientTokens());
        proposalId = ++proposalCount;

        proposals[proposalId] = Proposal({
            id:             proposalId,
            proposer:       msg.sender,
            description:    description,
            target:         target,
            callData:       callData,
            voteStart:      block.timestamp + VOTING_DELAY,
            voteEnd:        block.timestamp + VOTING_DELAY + VOTING_PERIOD,
            snapshotBlock:  block.number - 1, // Store the block for later!
            state:          ProposalState.PENDING,
            forVotes:       0,
            againstVotes:   0,
            abstainVotes:   0,
            tallyRequested: false,
            executed:       false
        });

        tally.initTally(proposalId);
        emit ProposalCreated(proposalId, msg.sender, description);
        return proposalId;
    }

    // ─── Cast Vote ────────────────────────────────────────────────────────
    function castVote(uint256 proposalId, einput encVote, bytes calldata proof) external {
        Proposal storage prop = proposals[proposalId];
        
        // Time checks still use timestamps
        require(block.timestamp >= prop.voteStart && block.timestamp <= prop.voteEnd, VotingNotActive());
        require(!hasVoted[proposalId][msg.sender], AlreadyVoted());

        // FIX: Fetch voting weight using the saved block number
        uint256 weight = token.getPastVotes(msg.sender, prop.snapshotBlock);
        require(weight > 0, InsufficientTokens());

        euint8 vote = TFHE.asEuint8(encVote, proof);
        tally.castVote(proposalId, vote, weight);

        hasVoted[proposalId][msg.sender] = true;

        if (prop.state == ProposalState.PENDING) {
            prop.state = ProposalState.ACTIVE;
        }

        emit VoteCast(proposalId, msg.sender);
    }

    // ─── Request Tally Decryption ─────────────────────────────────────────
    function requestTally(uint256 proposalId) external {
        Proposal storage prop = proposals[proposalId];
        require(block.timestamp > prop.voteEnd, VotingStillActive());
        require(!prop.tallyRequested, TallyAlreadyRequested());

        prop.state = ProposalState.TALLYING;
        prop.tallyRequested = true;
        tally.requestDecryption(proposalId, this.fulfillTally.selector);
    }

    // ─── Gateway Callback ─────────────────────────────────────────────────
    function fulfillTally(uint256 requestId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) external onlyGateway {
        uint256 proposalId = tally.getProposalForRequest(requestId);
        Proposal storage prop = proposals[proposalId];

        // SCALE UP: Restore the 18 decimals to the decrypted values
        forVotes = forVotes * 1e18;
        againstVotes = againstVotes * 1e18;
        abstainVotes = abstainVotes * 1e18;

        prop.forVotes     = forVotes;
        prop.againstVotes = againstVotes;
        prop.abstainVotes = abstainVotes;

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

        emit TallyRevealed(proposalId, forVotes, againstVotes, abstainVotes);
    }

    // ─── Execute ─────────────────────────────────────────────────────────
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
            prop.forVotes,
            prop.againstVotes,
            prop.abstainVotes
        );
    }

    function getVoterStatus(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
    }
}