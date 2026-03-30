// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SepoliaZamaFHEVMConfig } from "fhevm/config/ZamaFHEVMConfig.sol";
import { SepoliaZamaGatewayConfig } from "fhevm/config/ZamaGatewayConfig.sol";
import { GatewayCaller } from "fhevm/gateway/GatewayCaller.sol";
import { Gateway } from "fhevm/gateway/lib/Gateway.sol";
import { TFHE, euint8, euint128, ebool } from "fhevm/lib/TFHE.sol";

contract SealTally is
    SepoliaZamaFHEVMConfig,
    SepoliaZamaGatewayConfig,
    GatewayCaller
{
    address public governor;

    struct EncryptedTally {
        euint128 forVotes;
        euint128 againstVotes;
        euint128 abstainVotes;
        bool     initialised;
    }

    mapping(uint256 => EncryptedTally) internal _tallies;
    mapping(uint256 => uint256) internal _requestToProposal;

    modifier onlyGovernor() {
        require(msg.sender == governor, "SealTally: only governor");
        _;
    }

    constructor(address _governor) {
        governor = _governor;
    }

    // ─── Initialise ───────────────────────────────────────────────────────

    function initTally(uint256 proposalId) external onlyGovernor {
        _tallies[proposalId] = EncryptedTally({
            forVotes:     TFHE.asEuint128(0),
            againstVotes: TFHE.asEuint128(0),
            abstainVotes: TFHE.asEuint128(0),
            initialised:  true
        });

        TFHE.allowThis(_tallies[proposalId].forVotes);
        TFHE.allowThis(_tallies[proposalId].againstVotes);
        TFHE.allowThis(_tallies[proposalId].abstainVotes);
    }

    // ─── Accumulate Vote ──────────────────────────────────────────────────

    /**
     * @notice Add an encrypted vote to the running tally.
     * @param proposalId  Proposal being voted on
     * @param encVote     Encrypted vote direction (euint8: 0/1/2)
     * @param weight      Plaintext voting weight (token balance snapshot)
     *
     * @dev The vote direction is encrypted. The weight is plaintext.
     *      TFHE.select routes the weight to the correct encrypted tally
     *      without revealing which tally received the weight.
     *
     *      An observer sees: weight=500 tokens voted.
     *      An observer does NOT see: whether those 500 went to FOR or AGAINST.
     */
    function castVote(
        uint256 proposalId,
        euint8 encVote,
        uint256 weight
    ) external onlyGovernor {
        EncryptedTally storage t = _tallies[proposalId];

        euint128 encWeight = TFHE.asEuint128(weight);

        // Determine which bucket this vote belongs to (all in FHE)
        ebool isFor     = TFHE.eq(encVote, TFHE.asEuint8(1));
        ebool isAgainst = TFHE.eq(encVote, TFHE.asEuint8(0));
        ebool isAbstain = TFHE.eq(encVote, TFHE.asEuint8(2));

        // Add weight to correct tally — zero to the others
        t.forVotes     = TFHE.add(t.forVotes,
            TFHE.select(isFor, encWeight, TFHE.asEuint128(0)));
        t.againstVotes = TFHE.add(t.againstVotes,
            TFHE.select(isAgainst, encWeight, TFHE.asEuint128(0)));
        t.abstainVotes = TFHE.add(t.abstainVotes,
            TFHE.select(isAbstain, encWeight, TFHE.asEuint128(0)));

        TFHE.allowThis(t.forVotes);
        TFHE.allowThis(t.againstVotes);
        TFHE.allowThis(t.abstainVotes);
    }

    // ─── Request Decryption at Close ──────────────────────────────────────

    /**
     * @notice Submit all three tally ciphertexts to the Gateway for decryption.
     *         Called once when the voting period ends.
     *         The Gateway decrypts and calls back the governor's fulfillTally().
     */
    function requestDecryption(
        uint256 proposalId,
        bytes4 callbackSelector
    ) external onlyGovernor returns (uint256 requestId) {
        EncryptedTally storage t = _tallies[proposalId];

        uint256[] memory cts = new uint256[](3);
        cts[0] = euint128.unwrap(t.forVotes);
        cts[1] = euint128.unwrap(t.againstVotes);
        cts[2] = euint128.unwrap(t.abstainVotes);

        requestId = Gateway.requestDecryption(
            cts,
            callbackSelector,
            0,
            block.timestamp + 1 days,
            false
        );

        _requestToProposal[requestId] = proposalId;
    }

    function getProposalForRequest(uint256 requestId) external view returns (uint256) {
        return _requestToProposal[requestId];
    }
}
