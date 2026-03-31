// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, euint128, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title  SealTally
 * @notice Accumulates encrypted votes and makes tallies publicly decryptable
 *         after the voting period ends.
 *
 * Architecture (fhevm v0.11.x — no Gateway, no oracle):
 *   1. Governor calls initTally(proposalId)   → allocates three encrypted zeros.
 *   2. Governor calls castVote(...)            → FHE-multiplexes weight into the
 *      correct bucket without revealing which bucket.
 *   3. Governor calls requestDecryption(...)   → marks all three handles as
 *      publicly decryptable, exposing them to the off-chain relayer & KMS.
 *   4. Off-chain: anyone calls hre.fhevm.publicDecryptEuint() (tests) or the
 *      relayer SDK (production) to get the clear-text tally.
 *   5. Governor calls fulfillTally(...)        → stores the clear-text results
 *      and computes pass/fail.
 *
 * Privacy guarantee:
 *   - During voting the tallies stay encrypted; no one knows the running count.
 *   - Only after requestDecryption() are the tallies revealed, and only in TOTAL.
 *   - Individual votes are never decryptable — only the aggregate sum.
 */
contract SealTally is ZamaEthereumConfig {

    // ─── State ───────────────────────────────────────────────────────────────

    address public immutable governor;

    struct EncryptedTally {
        euint128 forVotes;
        euint128 againstVotes;
        euint128 abstainVotes;
        bool     initialised;
        bool     decryptionRequested;
    }

    mapping(uint256 => EncryptedTally) internal _tallies;

    // ─── Events ──────────────────────────────────────────────────────────────

    event TallyInitialised(uint256 indexed proposalId);
    event VoteAccumulated(uint256 indexed proposalId);
    event DecryptionRequested(uint256 indexed proposalId);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error OnlyGovernor();
    error TallyAlreadyInitialised();
    error TallyNotInitialised();
    error DecryptionAlreadyRequested();

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyGovernor() {
        if (msg.sender != governor) revert OnlyGovernor();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _governor) {
        governor = _governor;
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    /**
     * @notice Called by Governor when a new proposal is created.
     *         Allocates three FHE-encrypted zeros as initial tally buckets.
     */
    function initTally(uint256 proposalId) external onlyGovernor {
        if (_tallies[proposalId].initialised) revert TallyAlreadyInitialised();

        euint128 zero = FHE.asEuint128(uint128(0));

        _tallies[proposalId] = EncryptedTally({
            forVotes:             zero,
            againstVotes:         zero,
            abstainVotes:         zero,
            initialised:          true,
            decryptionRequested:  false
        });

        // Grant Governor and SealTally itself persistent ACL access to all three handles
        FHE.allowThis(zero);
        FHE.allow(zero, governor);

        emit TallyInitialised(proposalId);
    }

    // ─── Accumulate Vote ─────────────────────────────────────────────────────

    /**
     * @notice Add an encrypted vote to the running tally.
     *
     * @param proposalId  Proposal being voted on.
     * @param encVote     Already-verified encrypted vote direction (from SealGovernor).
     *                    0 = AGAINST, 1 = FOR, 2 = ABSTAIN.
     * @param weight      Plaintext voting weight (token snapshot, in wei).
     *
     * @dev Privacy mechanism:
     *      - vote direction is encrypted → coprocessor never reveals it.
     *      - FHE.select() routes `weight` into exactly one bucket
     *        without leaking which bucket it went to.
     *      - An observer sees: "address X contributed Y wei to the tally."
     *      - An observer does NOT see: whether Y went to FOR, AGAINST, or ABSTAIN.
     */
    function castVote(
        uint256       proposalId,
        euint8        encVote,
        uint256       weight
    ) external onlyGovernor {
        if (!_tallies[proposalId].initialised) revert TallyNotInitialised();

        EncryptedTally storage t = _tallies[proposalId];

        // encVote is already verified by SealGovernor before being passed here
        euint8 vote = encVote;

        // Wrap plaintext weight into an encrypted value (safe: weight is public)
        euint128 encWeight = FHE.asEuint128(uint128(weight));

        // Multiplexer: route weight to the correct bucket — zero to the others
        ebool isFor     = FHE.eq(vote, FHE.asEuint8(uint8(1)));
        ebool isAgainst = FHE.eq(vote, FHE.asEuint8(uint8(0)));
        ebool isAbstain = FHE.eq(vote, FHE.asEuint8(uint8(2)));

        euint128 zero = FHE.asEuint128(uint128(0));

        t.forVotes     = FHE.add(t.forVotes,     FHE.select(isFor,     encWeight, zero));
        t.againstVotes = FHE.add(t.againstVotes, FHE.select(isAgainst, encWeight, zero));
        t.abstainVotes = FHE.add(t.abstainVotes, FHE.select(isAbstain, encWeight, zero));

        // Keep ACL permissions current after every mutation
        FHE.allowThis(t.forVotes);
        FHE.allowThis(t.againstVotes);
        FHE.allowThis(t.abstainVotes);
        FHE.allow(t.forVotes,     governor);
        FHE.allow(t.againstVotes, governor);
        FHE.allow(t.abstainVotes, governor);

        emit VoteAccumulated(proposalId);
    }

    // ─── Request Public Decryption ────────────────────────────────────────────

    /**
     * @notice Mark all three tally handles as publicly decryptable.
     *
     * @dev In fhevm v0.11.x there is no blocking Gateway callback.
     *      Instead, `FHE.makePubliclyDecryptable()` registers the handles
     *      in the ACL so the KMS / relayer can serve decryption requests
     *      off-chain. The caller must then fetch the clear-text values
     *      via the relayer SDK and submit them back via fulfillTally().
     */
    function requestDecryption(uint256 proposalId) external onlyGovernor {
        EncryptedTally storage t = _tallies[proposalId];
        if (!t.initialised)         revert TallyNotInitialised();
        if (t.decryptionRequested)  revert DecryptionAlreadyRequested();

        t.decryptionRequested = true;

        // Mark all three ciphertexts as publicly decryptable in the ACL
        FHE.makePubliclyDecryptable(t.forVotes);
        FHE.makePubliclyDecryptable(t.againstVotes);
        FHE.makePubliclyDecryptable(t.abstainVotes);

        emit DecryptionRequested(proposalId);
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Returns the raw encrypted handles for off-chain consumption.
     */
    function getTallyHandles(uint256 proposalId)
        external
        view
        returns (bytes32 forHandle, bytes32 againstHandle, bytes32 abstainHandle)
    {
        EncryptedTally storage t = _tallies[proposalId];
        forHandle     = euint128.unwrap(t.forVotes);
        againstHandle = euint128.unwrap(t.againstVotes);
        abstainHandle = euint128.unwrap(t.abstainVotes);
    }

    function isDecryptionRequested(uint256 proposalId) external view returns (bool) {
        return _tallies[proposalId].decryptionRequested;
    }

    function isTallyInitialised(uint256 proposalId) external view returns (bool) {
        return _tallies[proposalId].initialised;
    }
}