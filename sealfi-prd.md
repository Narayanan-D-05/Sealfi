# SEALFI — Product Requirements Document

> SealFi is the first confidential DAO governance protocol on Ethereum using Zama's fhEVM. Every vote — `FOR`, `AGAINST`, `ABSTAIN` — is cast as an encrypted `euint8`. Running tallies are encrypted `euint128` values. No participant can see how a vote is trending until the proposal closes. Whales cannot coordinate last-minute swings. Vote buyers cannot verify their purchase was honoured. Delegates cannot signal alignment before counting. The tally is a sealed envelope. It opens exactly once: when the proposal closes.

---

| Field | Value |
|---|---|
| Project | SealFi |
| Sponsors | Zama · Starknet · Filecoin / Protocol Labs · Ethereum Foundation |
| Theme | Yellow `#FFE500` + Black `#0A0A0A` · Brutalist Minimalist |
| Version | 1.0 — Hackathon MVP |
| Stack | Next.js 14 · Solidity 0.8.24 · fhEVM · Hardhat · Wagmi · Viem |
| Fonts | Space Grotesk (display/headings) · Space Mono (data/code) |
| UI Builder | **Stitch MCP Server** (see Section 17) |
| Folders | `frontend/` · `contracts/` |

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Insight](#2-the-insight)
3. [The Wrapped Story](#3-the-wrapped-story)
4. [What SealFi Is](#4-what-sealfi-is)
5. [Why Vote Buying Is Structurally Impossible](#5-why-vote-buying-is-structurally-impossible)
6. [fhEVM Primer for This Project](#6-fhevm-primer-for-this-project)
7. [Contract Architecture](#7-contract-architecture)
8. [SealGovernor.sol — Core Contract](#8-sealgovernorsol--core-contract)
9. [SealTally.sol](#9-sealtallysol)
10. [SealToken.sol — Governance Token](#10-sealtokensol--governance-token)
11. [Vote Flow — Step by Step](#11-vote-flow--step-by-step)
12. [Tally and Execute Flow](#12-tally-and-execute-flow)
13. [UI Structure](#13-ui-structure)
14. [Landing Page](#14-landing-page)
15. [Proposals Page](#15-proposals-page)
16. [Vote Page](#16-vote-page)
17. [Stitch MCP Server — UI Build Instructions](#17-stitch-mcp-server--ui-build-instructions)
18. [Design System](#18-design-system)
19. [Project Structure](#19-project-structure)
20. [Environment and Deploy](#20-environment-and-deploy)
21. [Sponsor Alignment](#21-sponsor-alignment)
22. [README Selling Points](#22-readme-selling-points)
23. [MVP Scope](#23-mvp-scope)
24. [Demo Script (5 min)](#24-demo-script-5-min)

---

## 1. The Problem

Every DAO governance protocol — Compound Governor, OpenZeppelin Governor, Snapshot — publishes running vote tallies in real time.

```solidity
// OpenZeppelin Governor — completely public
uint256 public forVotes;      // 4,821,304 — everyone reads this
uint256 public againstVotes;  // 1,203,901 — everyone reads this
uint256 public abstainVotes;  // 94,021    — everyone reads this
```

This public running tally enables three distinct attack classes that have already extracted hundreds of millions from DAOs:

### Attack 1 — Last-minute whale coordination

A whale with 10% of supply watches the live tally. A proposal they oppose is winning with 2 hours to close. They wait until 10 minutes remain, then vote `AGAINST` — too late for the other side to respond. The live tally is the weapon: it tells the whale exactly when to strike for maximum impact with minimum counter-opportunity.

### Attack 2 — Vote buying with verifiable delivery

Vote-buying is a growing, multi-hundred-million-dollar market. LobbyFi accounted for 8–14% of votes on major Arbitrum proposals. The live tally is what makes vote buying work: the buyer pays the seller before the vote, the seller votes as instructed, the buyer watches the tally update in real time to verify delivery. If the tally does not move as expected, the buyer knows the seller defected and withholds further payment. The live tally is the receipt that makes the market function.

### Attack 3 — Strategic abstention and signalling

Large delegates watch live tallies and signal alignment without voting early — they wait to see how smaller participants vote, then coordinate their block to swing the outcome. The live tally is a real-time coordination mechanism for insiders who can move fastest.

The Compound DAO attack transferred $24 million from the treasury by aggregating delegations and coordinating proposal timing. Every dollar of that transfer was enabled by the public visibility of vote tallies during the voting period.

---

## 2. The Insight

The fix requires changing exactly one thing: the data type of the vote tally variables.

```solidity
// Standard Governor — full coordination surface
uint256 public forVotes;      // 4,821,304 — whales read this live
uint256 public againstVotes;  // 1,203,901 — buyers verify delivery here
uint256 public abstainVotes;  // 94,021    — delegates signal here

// SealFi — sealed until close
euint128 internal _forVotes;      // [encrypted] — null until proposal closes
euint128 internal _againstVotes;  // [encrypted] — null until proposal closes
euint128 internal _abstainVotes;  // [encrypted] — null until proposal closes
```

The protocol still counts every vote. Every token holder's voting weight is still recorded. The proposal still passes or fails based on the exact same quorum and majority rules. But nobody — not the whale, not the vote buyer, not the delegate — can see the running total until the proposal closes.

At close: the Gateway decrypts the final tallies. The result becomes public. The proposal executes if it passed. The sealed envelope opens exactly once.

The last-minute coordination attack requires knowing the live tally. It is impossible without it. The vote buying market requires the buyer to verify delivery via the live tally. It collapses without it. Strategic signalling requires watching the tally move. It is blind without it.

Three attacks. One variable type change.

---

## 3. The Wrapped Story

**"Every DAO vote is a live broadcast. Whales watch it and time their strikes. SealFi is a sealed envelope. It opens once, when it's over."**

Standard DAO governance: you cast your vote. The tally updates immediately. Every whale, every vote buyer, every delegate is watching that number. The vote is not decided by conviction — it is decided by who moves last with the most tokens.

SealFi: you cast your vote. Nothing changes publicly. The tally is encrypted. Nobody knows if the proposal is winning or losing. Whales cannot time their entry. Buyers cannot verify delivery. Delegates cannot coordinate based on live data. When the voting period ends, the Gateway decrypts the final result. The result executes. The envelope was sealed the entire time. It opened once.

The judge moment: open two governance UIs side by side. Snapshot shows `FOR: 4,821,304 / AGAINST: 1,203,901 / ABSTAIN: 94,021` — live, updating every block. SealFi shows `FOR: [sealed] / AGAINST: [sealed] / ABSTAIN: [sealed]`. Proposal is active. Votes are being cast. The tally is sealed. That is the image.

---

## 4. What SealFi Is

SealFi is an on-chain governance protocol — the same mechanics as OpenZeppelin Governor — where every vote tally is an fhEVM encrypted integer. Individual votes are cast as encrypted `euint8` values. Running totals accumulate as encrypted `euint128` values. The tally decrypts once, at proposal close, via the Zama Gateway async callback.

Three contracts:

| Contract | Role |
|---|---|
| `SealGovernor.sol` | Core governance — proposals, voting, execution, encrypted tallying |
| `SealTally.sol` | Tally accumulation and Gateway decryption request on close |
| `SealToken.sol` | Governance token — encrypted balances, voting weight |

---

## 5. Why Vote Buying Is Structurally Impossible

### Last-minute whale coordination

**Requires:** read live `forVotes` and `againstVotes`, calculate the gap, determine the optimal moment to vote for maximum impact with minimum counter-opportunity.

**Against SealFi:** `_forVotes = euint128(ciphertext)`. The gap cannot be calculated. The whale votes blind — they do not know if their vote is decisive or redundant. The timing advantage is zero.

### Vote buying with verifiable delivery

**Requires:** pay seller before vote, seller casts instructed vote, buyer reads live tally to verify the purchased vote moved the tally as expected, complete payment.

**Against SealFi:** `_forVotes = euint128(ciphertext)`. The tally does not move visibly. The buyer cannot verify delivery. A seller can take the payment, vote however they want, and the buyer has no way to know until the final reveal — by which point the vote is closed and payment already sent. The verification mechanism that makes vote buying a rational market is destroyed.

### Strategic delegate signalling

**Requires:** watch live tally to understand current trajectory, coordinate with other delegates based on real-time data, vote as a coordinated block at the optimal moment.

**Against SealFi:** no live data. Delegates vote blind. Coordination based on real-time tally information is impossible. Each voter makes an independent decision based on the proposal itself — not based on who else has voted.

### What still works

- Every token holder can vote — unchanged
- Voting weight is proportional to token balance — unchanged
- Quorum and majority thresholds are enforced — unchanged
- Proposals execute automatically on passing — unchanged
- Every vote is recorded on-chain and auditable after close — unchanged

The only thing that changes: nobody knows the running total until the vote is over.

---

## 6. fhEVM Primer for This Project

### Types used

```solidity
euint8    — encrypted 8-bit integer  (vote direction: 0=AGAINST, 1=FOR, 2=ABSTAIN)
euint128  — encrypted 128-bit integer (vote tallies, token weights)
ebool     — encrypted boolean         (quorum check, majority check)
externalEuint8 — user-provided encrypted vote direction
```

### Operations used

```solidity
FHE.add(a, b)              // accumulate votes into running tally
FHE.eq(vote, value)        // check if encrypted vote == FOR (returns ebool)
FHE.select(cond, a, b)     // add weight to correct tally based on vote direction
FHE.ge(tally, threshold)   // check if tally >= quorum threshold (returns ebool)
FHE.fromExternal(h, proof) // verify user-provided vote ciphertext
FHE.allow(handle, addr)    // grant decrypt permission post-close
FHE.allowThis(handle)      // contract maintains access during voting
FHE.asEuint128(0)          // initialise encrypted tally at zero
```

### The vote accumulation — core FHE operation

```solidity
// Standard Governor (public):
// if (vote == FOR) forVotes += weight;
// else if (vote == AGAINST) againstVotes += weight;

// SealFi (encrypted):
// Encrypted weight addition to the correct tally
// without revealing which tally received the weight

euint128 weight = FHE.asEuint128(voterWeight); // plaintext weight → encrypted

// Is this vote FOR? (encrypted comparison)
ebool isFor     = FHE.eq(encVote, FHE.asEuint8(1));
ebool isAgainst = FHE.eq(encVote, FHE.asEuint8(0));
ebool isAbstain = FHE.eq(encVote, FHE.asEuint8(2));

// Add weight to correct tally using FHE.select
// If isFor: _forVotes += weight, else += 0
_forVotes     = FHE.add(_forVotes, FHE.select(isFor,     weight, FHE.asEuint128(0)));
_againstVotes = FHE.add(_againstVotes, FHE.select(isAgainst, weight, FHE.asEuint128(0)));
_abstainVotes = FHE.add(_abstainVotes, FHE.select(isAbstain, weight, FHE.asEuint128(0)));

// Nobody sees which tally moved or by how much
// The sum of all tallies is computable but reveals nothing individually
```

### Gateway decryption at close

When a proposal's voting period ends, `SealTally.requestTallyDecryption()` submits all three tally ciphertexts to the Zama Gateway. The Gateway decrypts and calls back `fulfillTally(requestId, forVotes, againstVotes, abstainVotes)`. Only at this point do tallies become public. The proposal executes or rejects based on the revealed numbers.

---

## 7. Contract Architecture

```
contracts/
├── SealGovernor.sol   ← Core: proposals, voting period, execution
├── SealTally.sol      ← Encrypted tally accumulation + Gateway decryption
└── SealToken.sol      ← Governance token with encrypted balances
```

---

## 8. SealGovernor.sol — Core Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SepoliaZamaFHEVMConfig } from "fhevm/config/ZamaFHEVMConfig.sol";
import { SepoliaZamaGatewayConfig } from "fhevm/config/ZamaGatewayConfig.sol";
import { GatewayCaller } from "fhevm/gateway/GatewayCaller.sol";
import { FHE, euint8, euint128, ebool, externalEuint8 } from "fhevm/lib/FHE.sol";
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
        externalEuint8 encVote,
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
        euint8 vote = FHE.fromExternal(encVote, proof);

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

    modifier onlyGateway() {
        require(msg.sender == address(Gateway), "SealGovernor: only gateway");
        _;
    }
}
```

---

## 9. SealTally.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SepoliaZamaFHEVMConfig } from "fhevm/config/ZamaFHEVMConfig.sol";
import { SepoliaZamaGatewayConfig } from "fhevm/config/ZamaGatewayConfig.sol";
import { GatewayCaller } from "fhevm/gateway/GatewayCaller.sol";
import { FHE, euint8, euint128, ebool } from "fhevm/lib/FHE.sol";

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
            forVotes:     FHE.asEuint128(0),
            againstVotes: FHE.asEuint128(0),
            abstainVotes: FHE.asEuint128(0),
            initialised:  true
        });

        FHE.allowThis(_tallies[proposalId].forVotes);
        FHE.allowThis(_tallies[proposalId].againstVotes);
        FHE.allowThis(_tallies[proposalId].abstainVotes);
    }

    // ─── Accumulate Vote ──────────────────────────────────────────────────

    /**
     * @notice Add an encrypted vote to the running tally.
     * @param proposalId  Proposal being voted on
     * @param encVote     Encrypted vote direction (euint8: 0/1/2)
     * @param weight      Plaintext voting weight (token balance snapshot)
     *
     * @dev The vote direction is encrypted. The weight is plaintext.
     *      FHE.select routes the weight to the correct encrypted tally
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

        euint128 encWeight = FHE.asEuint128(weight);

        // Determine which bucket this vote belongs to (all in FHE)
        ebool isFor     = FHE.eq(encVote, FHE.asEuint8(1));
        ebool isAgainst = FHE.eq(encVote, FHE.asEuint8(0));
        ebool isAbstain = FHE.eq(encVote, FHE.asEuint8(2));

        // Add weight to correct tally — zero to the others
        t.forVotes     = FHE.add(t.forVotes,
            FHE.select(isFor, encWeight, FHE.asEuint128(0)));
        t.againstVotes = FHE.add(t.againstVotes,
            FHE.select(isAgainst, encWeight, FHE.asEuint128(0)));
        t.abstainVotes = FHE.add(t.abstainVotes,
            FHE.select(isAbstain, encWeight, FHE.asEuint128(0)));

        FHE.allowThis(t.forVotes);
        FHE.allowThis(t.againstVotes);
        FHE.allowThis(t.abstainVotes);
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
```

---

## 10. SealToken.sol — Governance Token

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @notice SealFi governance token.
 *
 * Note: This token uses standard ERC20Votes — balances are PUBLIC.
 *
 * This is an intentional and honest design decision:
 *
 * The AMOUNT of voting power each address holds is already public
 * on every existing governance protocol. SealFi does not hide this.
 * What SealFi hides is HOW each address voted — the direction.
 *
 * An attacker knows: Alice holds 500,000 SEAL tokens.
 * An attacker does NOT know: Alice voted FOR or AGAINST.
 * An attacker cannot see: whether the proposal is currently winning.
 *
 * Hiding token balances (using ConfidentialERC20) is a separate problem
 * orthogonal to vote direction privacy. SealFi solves vote direction privacy.
 * ConfidentialERC20 integration is a V2 consideration.
 */
contract SealToken is ERC20, ERC20Votes, ERC20Permit {

    address public owner;

    constructor()
        ERC20("SealFi Governance Token", "SEAL")
        ERC20Permit("SealFi Governance Token")
    {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // Required overrides
    function _update(address from, address to, uint256 value)
        internal override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address account)
        public view override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(account);
    }
}
```

---

## 11. Vote Flow — Step by Step

```
USER ACTION
───────────
1. User opens SealFi vote page for Proposal #3
2. User selects their vote: FOR
3. User clicks Cast Vote

FRONTEND (fhEVM.js SDK)
───────────────────────
4. Encrypt vote direction FOR = 1:
   const { handle: encVote, proof } = await fhevm.encrypt8(1n);
5. Call SealGovernor.castVote(3, encVote, proof)

ON-CHAIN (SealGovernor + SealTally)
─────────────────────────────────────
6. Voting period confirmed active
7. hasVoted[3][msg.sender] = false ✓ (not yet voted)
8. weight = token.getPastVotes(msg.sender, voteStart) = 500,000 SEAL
9. euint8 vote = FHE.fromExternal(encVote, proof)  ← verified ciphertext

10. SealTally.castVote(3, vote, 500000):
    - isFor     = FHE.eq(vote, euint8(1))  ← encrypted boolean
    - isAgainst = FHE.eq(vote, euint8(0))
    - isAbstain = FHE.eq(vote, euint8(2))
    - forVotes     += FHE.select(isFor, 500000, 0)     ← adds 500000 encrypted
    - againstVotes += FHE.select(isAgainst, 500000, 0) ← adds 0 encrypted
    - abstainVotes += FHE.select(isAbstain, 500000, 0) ← adds 0 encrypted

11. hasVoted[3][msg.sender] = true
12. Emit VoteCast(3, msg.sender)
    ← Note: no vote direction in event

WHALE WATCHING THE TALLY
──────────────────────────
13. Whale queries SealGovernor.getProposal(3):
    Returns: forVotes=0, againstVotes=0, abstainVotes=0
    (sealed — zero until Gateway reveal at close)
14. Whale cannot see the tally moved by 500,000 FOR
15. Whale cannot time their vote for maximum impact
16. Whale votes blind — based on the proposal itself, not the trend

VOTE BUYER
───────────
17. Buyer paid Alice 0.1 ETH to vote AGAINST
18. Alice voted FOR (defected — took the money and voted her conviction)
19. Buyer watches the tally: 0, 0, 0 — all sealed
20. Buyer cannot verify Alice voted as instructed
21. The vote buying market collapses — delivery cannot be verified
```

---

## 12. Tally and Execute Flow

```
AFTER VOTING PERIOD ENDS
──────────────────────────
1. Anyone calls SealGovernor.requestTally(proposalId)
   prop.state = TALLYING
   SealTally.requestDecryption(proposalId, fulfillTally.selector)

GATEWAY DECRYPTION (async, ~3 seconds)
────────────────────────────────────────
2. Zama Gateway receives decryption request for 3 ciphertexts
3. FHE coprocessors decrypt: forVotes, againstVotes, abstainVotes
4. Gateway calls SealGovernor.fulfillTally(requestId, for, against, abstain)

ON-CHAIN (SealGovernor.fulfillTally)
──────────────────────────────────────
5. prop.forVotes = forVotes (NOW PUBLIC for first time)
6. prop.againstVotes = againstVotes
7. prop.abstainVotes = abstainVotes
8. Check quorum: totalVotes >= 4% of supply?
9. Check majority: forVotes > againstVotes?
10. If both: state = SUCCEEDED, emit TallyRevealed(id, for, against, abstain)
11. If not: state = DEFEATED, emit ProposalDefeated(id)

EXECUTION
──────────
12. Anyone calls SealGovernor.execute(proposalId)
13. Target contract called with stored callData
14. State = EXECUTED

WHAT THE WORLD LEARNS (and when)
──────────────────────────────────
During voting:    Nothing. Tallies are sealed.
After close:      Final for/against/abstain counts — public and permanent.
Individual votes: How each address voted — NEVER revealed.
                  Only the aggregate result becomes public.
```

---

## 13. UI Structure

Three pages. Brutalist yellow-black. During the voting period, every tally shows `[sealed]` — not `[encrypted]` as in SHADE/NullFi, but `[sealed]` — because the metaphor here is a sealed envelope, not an encrypted value. After close, the real numbers appear.

| Page | Route | Purpose |
|---|---|---|
| Landing | `/` | Hero, problem/solution, live proposal feed showing `[sealed]` tallies |
| Proposals | `/proposals` | List all proposals — active show `[sealed]`, closed show real tallies |
| Vote | `/vote/:id` | Cast encrypted vote on a specific proposal |

---

## 14. Landing Page

```
┌──────────────────────────────────────────────────────────────────────┐
│  SEALFI                             [Connect Wallet]  [Launch App]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  EVERY VOTE                                                          │
│  IS SEALED.                                                          │
│                                                                      │
│  DAOs publish live tallies. Whales watch the trend                  │
│  and time their strike. Vote buyers verify delivery.                │
│  SealFi seals the envelope. It opens once, when                     │
│  voting ends. Not before.                                            │
│                                                                      │
│  [Launch Governance →]                                               │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PROOF.                                                              │
│  ────────────────────────────────────────────────────               │
│                                                                      │
│  Compound Governor (live):   FOR: 4,821,304                         │
│                              AGAINST: 1,203,901                     │
│                              ABSTAIN: 94,021                        │
│                                                                      │
│  SealFi (same proposal):     FOR: [sealed]                          │
│                              AGAINST: [sealed]                      │
│                              ABSTAIN: [sealed]                      │
│                                                                      │
│  Both protocols are counting the same votes.                        │
│  Only one of them tells you the score.                              │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ACTIVE PROPOSALS                                                    │
│  ──────────────────────────────────────────────────────             │
│  #3  Increase treasury allocation     2d 14h left  [sealed]         │
│  #2  Add new collateral type          1d 3h left   [sealed]         │
│  #1  Protocol fee adjustment          CLOSED       FOR: 2.1M  ✓    │
│                                                                      │
│  Active proposals show [sealed]. Closed proposals reveal the tally. │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  HOW IT WORKS                                                        │
│  ──────────────────────────────────────────────────────             │
│                                                                      │
│  01  You vote. Direction is encrypted using Zama fhEVM.             │
│  02  Your vote accumulates into an encrypted tally.                 │
│  03  Nobody sees the tally during voting. Not even the protocol.    │
│  04  When voting ends, the Gateway decrypts the final count.        │
│  05  Result executes. Envelope opened once.                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 15. Proposals Page

```
┌──────────────────────────────────────────────────────────────────────┐
