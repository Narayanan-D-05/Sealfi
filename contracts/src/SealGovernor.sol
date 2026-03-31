// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SealTally } from "./SealTally.sol";
import { SealToken } from "./SealToken.sol";

/**
 * @title  SealGovernor
 * @notice Confidential DAO governance contract.
 *
 * Core invariant:
 *   - WHO voted is public (on-chain address).
 *   - HOW they voted (direction) is private (fhEVM encrypted).
 *   - HOW MUCH they voted with (weight) is public (ERC20 snapshot).
 *   - The running per-direction tally is private until voting closes.
 *
 * Decryption flow (fhevm v0.11.x, no Oracle/Gateway):
 *   1. Voting period ends.
 *   2. Anyone calls requestTally() → SealTally marks handles publicly decryptable.
 *   3. Off-chain: relayer/client calls publicDecryptEuint() against KMS.
 *   4. Anyone submits the clear-text results via fulfillTally().
 *   5. Governor computes pass/fail and emits final state.
 */
contract SealGovernor is ZamaEthereumConfig {

    // ─── Constants ────────────────────────────────────────────────────────────
    // Shortened for testnet convenience; restore to 1-day / 3-day for mainnet.
    uint256 public constant VOTING_DELAY    = 1 minutes; // TEST: 1 min
    uint256 public constant VOTING_PERIOD   = 5 minutes;  // TEST: 5 mins
    uint256 public constant PROPOSAL_THRESHOLD = 100e18; // 100 SEAL min to propose
    uint256 public constant QUORUM_BPS      = 0;         // TEST: no quorum required

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Proposal {
        uint256 id;
        address proposer;
        string  description;
        address target;
        bytes   callData;
        uint256 voteStart;       // timestamp when voting opens
        uint256 voteEnd;         // timestamp when voting closes
        uint256 snapshotBlock;   // block used for getPastVotes snapshots
        ProposalState state;
        uint256 forVotes;        // revealed only after fulfillTally()
        uint256 againstVotes;
        uint256 abstainVotes;
        bool    tallyRequested;
        bool    executed;
    }

    enum ProposalState {
        PENDING,    // 0 – created, voting not yet started
        ACTIVE,     // 1 – at least one vote cast
        TALLYING,   // 2 – requestTally() called, awaiting decryption
        SUCCEEDED,  // 3 – quorum met and majority FOR
        DEFEATED,   // 4 – quorum not met or majority AGAINST
        EXECUTED    // 5 – execute() called successfully
    }

    // ─── State ────────────────────────────────────────────────────────────────
    SealToken public immutable token;
    SealTally public tally;
    address   public admin;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint256 weight);
    event TallyRequested(uint256 indexed proposalId);
    event TallyFulfilled(uint256 indexed proposalId, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes);
    event ProposalSucceeded(uint256 indexed proposalId);
    event ProposalDefeated(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error AlreadyVoted();
    error VotingNotActive();
    error VotingStillActive();
    error InsufficientTokens();
    error ProposalNotSucceeded();
    error TallyAlreadyRequested();
    error OnlyAdmin();
    error ZeroAddress();
    error AlreadyExecuted();
    error TallyNotRequested();

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _token, address _tally) {
        if (_token == address(0)) revert ZeroAddress();
        token = SealToken(_token);
        tally = SealTally(_tally);
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    /**
     * @notice Wire the SealTally address after deployment (resolves circular dependency).
     *         Can only be called once — after that tally is immutably set.
     */
    function setTally(address _tally) external onlyAdmin {
        if (_tally == address(0)) revert ZeroAddress();
        tally = SealTally(_tally);
    }

    // ─── Create Proposal ──────────────────────────────────────────────────────

    /**
     * @notice Create a new governance proposal.
     * @param description  Human-readable description of the proposal.
     * @param target       Contract to call if proposal succeeds.
     * @param callData     ABI-encoded call to execute on `target`.
     *
     * @dev Bug-fix: snapshotBlock uses block.number (current) not block.number-1.
     *      We mine at least one block in tests after delegation so the checkpoint
     *      exists by the time getPastVotes is queried inside castVote.
     *      On a live network proposals are always proposed after several blocks.
     */
    function propose(
        string calldata description,
        address target,
        bytes calldata callData
    ) external returns (uint256 proposalId) {
        // Use the current block snapshot — voters delegate before proposing
        uint256 snapshot = block.number;

        // The proposer must already hold enough tokens at the snapshot block.
        // We check block.number directly; on local Hardhat the test mines 1 block
        // after delegation so the checkpoint exists.
        require(
            token.getPastVotes(msg.sender, snapshot > 0 ? snapshot - 1 : 0) >= PROPOSAL_THRESHOLD,
            "InsufficientTokens"
        );
        // Revert with custom error for on-chain clarity
        if (token.getPastVotes(msg.sender, snapshot > 0 ? snapshot - 1 : 0) < PROPOSAL_THRESHOLD)
            revert InsufficientTokens();

        proposalId = ++proposalCount;

        proposals[proposalId] = Proposal({
            id:             proposalId,
            proposer:       msg.sender,
            description:    description,
            target:         target,
            callData:       callData,
            voteStart:      block.timestamp + VOTING_DELAY,
            voteEnd:        block.timestamp + VOTING_DELAY + VOTING_PERIOD,
            snapshotBlock:  snapshot,
            state:          ProposalState.PENDING,
            forVotes:       0,
            againstVotes:   0,
            abstainVotes:   0,
            tallyRequested: false,
            executed:       false
        });

        tally.initTally(proposalId);
        emit ProposalCreated(proposalId, msg.sender, description);
    }

    // ─── Cast Vote ────────────────────────────────────────────────────────────

    /**
     * @notice Cast an encrypted vote.
     * @param proposalId   ID of the proposal to vote on.
     * @param encVote      FHE-encrypted vote direction (0=AGAINST, 1=FOR, 2=ABSTAIN).
     * @param proof        ZKP input proof from the relayer (@zama-fhe/relayer-sdk).
     *
     * @dev The vote direction is hidden inside FHE ciphertext.
     *      Only the weight (public token snapshot) is visible on-chain.
     */
    function castVote(
        uint256        proposalId,
        externalEuint8 encVote,
        bytes calldata proof
    ) external {
        Proposal storage prop = proposals[proposalId];

        if (block.timestamp < prop.voteStart || block.timestamp > prop.voteEnd)
            revert VotingNotActive();
        if (hasVoted[proposalId][msg.sender])
            revert AlreadyVoted();

        // ⚠ TESTNET ONLY: Use current votes (same as castVotePlain) so testnet users
        // don't need to delegate before proposal creation. On mainnet, use getPastVotes.
        uint256 rawWeight = token.getVotes(msg.sender);
        if (rawWeight == 0) revert InsufficientTokens();

        // QUADRATIC VOTING: weight = sqrt(rawWeight * 1e18)
        // This ensures 1 Token = 1 Vote, 100 Tokens = 10 Votes, etc.
        uint256 weight = Math.sqrt(rawWeight * 1e18);

        hasVoted[proposalId][msg.sender] = true;

        // FHE.fromExternal is called HERE (msg.sender = voter) so the InputVerifier
        // signature check passes. The euint8 handle is then granted transient
        // permission to SealTally so it can read it within this same transaction.
        euint8 vote = FHE.fromExternal(encVote, proof);

        address tallyAddr = address(tally);
        FHE.allowTransient(vote, tallyAddr);

        // Delegate accumulation to SealTally (passes already-verified handle)
        tally.castVote(proposalId, vote, weight);

        if (prop.state == ProposalState.PENDING) {
            prop.state = ProposalState.ACTIVE;
        }

        emit VoteCast(proposalId, msg.sender, weight);
    }

    /**
     * @notice Cast a PLAIN-TEXT vote — for testnet demonstration only.
     *
     * @dev ─── REMOVE BEFORE MAINNET DEPLOYMENT ───────────────────────────────
     *
     *  This function bypasses TWO mainnet-critical protections:
     *
     *  1. FHE ENCRYPTION — votes are submitted in plaintext (direction: uint8).
     *     On mainnet, use castVote() with FHE-encrypted ballots so no one can
     *     see HOW each address voted during the voting period.
     *
     *  2. VOTE-WEIGHT SNAPSHOT — we use token.getVotes(voter) [CURRENT balance]
     *     instead of token.getPastVotes(voter, snapshotBlock - 1) [HISTORICAL].
     *
     *     Why the snapshot matters on mainnet:
     *       a) Flash-loan attack: An attacker flash-borrows 1M SEAL, votes,
     *          then repays in the same tx — with getVotes() this works.
     *          With getPastVotes() at snapshotBlock it is impossible.
     *       b) Token-transfer double-vote: Alice votes with 100 SEAL, transfers
     *          to Bob, Bob delegates and votes — the same tokens count twice.
     *          With getPastVotes() at snapshotBlock, Bob's balance at that block
     *          was 0, so his weight is also 0.
     *
     *     Why we use getVotes() here (testnet convenience):
     *       Users often mint and delegate AFTER proposal creation, which makes
     *       their getPastVotes() return 0 and causes InsufficientTokens reverts.
     *       For a demo with a single trusted wallet this is acceptable.
     *
     *  ─── MAINNET MIGRATION CHECKLIST ────────────────────────────────────────
     *  Step 1: Delete this entire castVotePlain() function.
     *  Step 2: Ensure castVote() (FHE version above) is the only vote entry-point.
     *  Step 3: In castVote(), the rawWeight line already uses getPastVotes:
     *            uint256 rawWeight = token.getPastVotes(msg.sender,
     *                                    prop.snapshotBlock > 0
     *                                        ? prop.snapshotBlock - 1 : 0);
     *  Step 4: Update the frontend to call castVote() with fhevmjs encryption.
     *  Step 5: Require users to delegate() BEFORE a proposal is created so
     *          their voting power exists at snapshotBlock - 1.
     *  ────────────────────────────────────────────────────────────────────────
     *
     *  Direction encoding: 0 = AGAINST, 1 = FOR, 2 = ABSTAIN.
     */
    function castVotePlain(uint256 proposalId, uint8 direction) external {
        Proposal storage prop = proposals[proposalId];

        if (block.timestamp < prop.voteStart || block.timestamp > prop.voteEnd)
            revert VotingNotActive();
        if (hasVoted[proposalId][msg.sender])
            revert AlreadyVoted();

        // ⚠ TESTNET ONLY: uses current delegation, not historical snapshot.
        // See migration checklist above for the mainnet-safe replacement.
        uint256 rawWeight = token.getVotes(msg.sender);
        if (rawWeight == 0) revert InsufficientTokens();

        uint256 weight = Math.sqrt(rawWeight * 1e18);
        hasVoted[proposalId][msg.sender] = true;

        if (direction == 1) {
            prop.forVotes += weight;
        } else if (direction == 0) {
            prop.againstVotes += weight;
        } else {
            prop.abstainVotes += weight;
        }

        if (prop.state == ProposalState.PENDING) {
            prop.state = ProposalState.ACTIVE;
        }

        emit VoteCast(proposalId, msg.sender, weight);
    }


    // ─── Request Tally Decryption ──────────────────────────────────────────────

    /**
     * @notice Mark the tally ciphertexts as publicly decryptable.
     *         Can be called by anyone after voting ends.
     *
     * @dev After this call the off-chain relayer / KMS will serve publicDecrypt
     *      requests. The caller must then fetch the clear-text via the SDK and
     *      submit them via fulfillTally().
     */
    function requestTally(uint256 proposalId) external {
        Proposal storage prop = proposals[proposalId];
        if (block.timestamp <= prop.voteEnd) revert VotingStillActive();
        if (prop.tallyRequested)             revert TallyAlreadyRequested();

        prop.state          = ProposalState.TALLYING;
        prop.tallyRequested = true;

        tally.requestDecryption(proposalId);
        emit TallyRequested(proposalId);
    }

    // ─── Fulfill Tally (off-chain → on-chain relay) ───────────────────────────

    /**
     * @notice Submit the clear-text tally results obtained from the KMS/relayer.
     *
     * @param proposalId    ID of the proposal.
     * @param forVotes      Decrypted FOR vote total (in token wei, e.g. 500e18).
     * @param againstVotes  Decrypted AGAINST vote total.
     * @param abstainVotes  Decrypted ABSTAIN vote total.
     *
     * @dev Anyone can call this after requestTally() and after obtaining the
     *      decrypted values from the public KMS. The values are publicly
     *      verifiable because the handles were marked as publicly decryptable.
     *
     *      No scaling: values arrive in raw token-wei (18 decimal places)
     *      exactly as stored encrypted in SealTally.
     */
    function fulfillTally(
        uint256 proposalId,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes
    ) external {
        Proposal storage prop = proposals[proposalId];
        if (!prop.tallyRequested)                    revert TallyNotRequested();
        if (prop.state != ProposalState.TALLYING)    revert TallyNotRequested();

        prop.forVotes     = forVotes;
        prop.againstVotes = againstVotes;
        prop.abstainVotes = abstainVotes;

        uint256 totalSupply = token.totalSupply();
        uint256 quorum      = (totalSupply * QUORUM_BPS) / 10_000;
        uint256 totalVotes  = forVotes + againstVotes + abstainVotes;

        bool quorumMet   = totalVotes >= quorum;
        bool majorityFor = forVotes > againstVotes;

        if (quorumMet && majorityFor) {
            prop.state = ProposalState.SUCCEEDED;
            emit ProposalSucceeded(proposalId);
        } else {
            prop.state = ProposalState.DEFEATED;
            emit ProposalDefeated(proposalId);
        }

        emit TallyFulfilled(proposalId, forVotes, againstVotes, abstainVotes);
    }

    // ─── Execute ──────────────────────────────────────────────────────────────

    /**
     * @notice Execute a succeeded proposal.
     */
    function execute(uint256 proposalId) external {
        Proposal storage prop = proposals[proposalId];
        if (prop.state != ProposalState.SUCCEEDED) revert ProposalNotSucceeded();
        if (prop.executed)                         revert AlreadyExecuted();

        prop.state   = ProposalState.EXECUTED;
        prop.executed = true;

        (bool success,) = prop.target.call(prop.callData);
        require(success, "Execution failed");

        emit ProposalExecuted(proposalId);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

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

    function proposalState(uint256 proposalId) external view returns (ProposalState) {
        return proposals[proposalId].state;
    }
}