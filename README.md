# SealFi — Confidential DAO Governance

> The first confidential DAO governance protocol on Ethereum using Zama's fhEVM. Every vote is sealed until the proposal closes.

![Theme](https://img.shields.io/badge/Theme-Yellow%20%26%20Black-FFE500)
![Stack](https://img.shields.io/badge/Stack-Next.js%2014%20%C2%B7%20Solidity%20%C2%B7%20fhEVM-blue)

## Why SealFi Exists

Every DAO governance protocol publishes live vote tallies. `forVotes: 4,821,304`. `againstVotes: 1,203,901`. Updating every block. Visible to every whale, every vote buyer, every coordinated delegate.

This live tally is the attack surface. Whales watch it and time their entry for maximum impact. Vote buyers pay for votes and verify delivery by watching the tally update. Delegates signal alignment without committing early.

**SealFi seals the tally.** Your vote is cast as an encrypted `euint8`. It accumulates into an encrypted `euint128` running total. Nobody — not whales, not vote buyers, not the protocol itself — can see the running count until the voting period ends.

## The Stunt

```solidity
// OpenZeppelin Governor — full coordination surface
uint256 public forVotes;      // 4,821,304 — whales time their strike here
uint256 public againstVotes;  // 1,203,901 — buyers verify delivery here
uint256 public abstainVotes;  // 94,021    — delegates signal here

// SealFi — sealed until close
euint128 internal _forVotes;      // [sealed] — null during voting
euint128 internal _againstVotes;  // [sealed] — null during voting
euint128 internal _abstainVotes;  // [sealed] — null during voting
```

Three variable declarations. Last-minute coordination impossible. Vote buying market collapses. Strategic signalling blind.

## Project Structure

```
sealfi/
├── contracts/
│   ├── SealGovernor.sol    # Core governance with encrypted voting
│   ├── SealTally.sol       # Encrypted tally accumulation
│   ├── SealToken.sol       # ERC20Votes governance token
│   ├── hardhat.config.ts   # Hardhat configuration
│   └── scripts/
│       ├── deploy.ts       # Deployment script
│       └── seed.ts         # Seed with demo data
│
└── frontend/
    ├── app/
    │   ├── page.tsx              # Landing page
    │   ├── proposals/page.tsx    # Proposals list
    │   └── vote/[id]/page.tsx    # Vote casting
    ├── components/
    │   ├── layout/Navbar.tsx
    │   ├── ui/SealedValue.tsx
    │   ├── ui/CountdownTimer.tsx
    │   └── ui/StatusBadge.tsx
    ├── hooks/
    │   ├── useGovernor.ts
    │   ├── useVote.ts
    │   └── useProposals.ts
    └── lib/
        ├── contracts.ts
        └── wagmi.ts
```

## Environment Variables

### Contracts

Create `contracts/.env`:

```bash
DEPLOYER_PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
```

### Frontend

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
NEXT_PUBLIC_WC_PROJECT_ID=your_walletconnect_project_id

# Contract Addresses (fill after deployment)
NEXT_PUBLIC_SEAL_GOVERNOR_ADDRESS=0x...
NEXT_PUBLIC_SEAL_TALLY_ADDRESS=0x...
NEXT_PUBLIC_SEAL_TOKEN_ADDRESS=0x...
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Contracts
cd contracts
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Deploy Contracts

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network fhevm_sepolia
```

Save the output addresses for your frontend `.env.local`.

### 3. Seed with Demo Data

```bash
npx hardhat run scripts/seed.ts --network fhevm_sepolia
```

### 4. Run Frontend

```bash
cd ../frontend
npm run dev
```

Visit `http://localhost:3000`

## How It Works

### Vote Flow

1. **User opens vote page** — Proposal details shown, tally shows `[sealed]`
2. **User selects vote** — FOR, AGAINST, or ABSTAIN
3. **Frontend encrypts vote** — Using fhEVM.js SDK: `encrypt8(1)` for FOR
4. **Transaction submitted** — `SealGovernor.castVote(proposalId, encVote, proof)`
5. **Contract accumulates** — `SealTally` adds encrypted weight to correct tally using `FHE.select`
6. **Tally remains sealed** — Nobody sees which tally moved or by how much
7. **When voting ends** — Anyone can call `requestTally()` to trigger Gateway decryption
8. **Gateway callback** — `fulfillTally()` reveals final counts, state becomes SUCCEEDED/DEFEATED

### Key FHE Operations

```solidity
// Route weight to correct tally without revealing direction
ebool isFor = FHE.eq(encVote, FHE.asEuint8(1));
_forVotes = FHE.add(_forVotes, FHE.select(isFor, weight, FHE.asEuint128(0)));
```

## Design System

**Colors:**
- Black: `#0A0A0A`
- Yellow: `#FFE500`
- White: `#F5F5F5`
- Gray: `#888888`

**Typography:**
- Headings: Space Grotesk (700/800 weight)
- Data/Code: Space Mono

**Style:** Brutalist minimalist — zero gradients, sharp corners (2px on inputs only), high contrast.

## Pages

### Landing (`/`)
- Hero: "EVERY VOTE IS SEALED."
- Side-by-side comparison with Compound Governor
- Active proposals feed
- How-it-works section

### Proposals (`/proposals`)
- Filter tabs: ALL / ACTIVE / CLOSED
- Proposal cards with `[sealed]` tallies for active
- Real numbers revealed for closed proposals

### Vote (`/vote/:id`)
- Proposal details
- Sealed tally display
- Three vote buttons (FOR / AGAINST / ABSTAIN)
- Voting power display
- Encrypted vote casting

## Sponsor Alignment

| Sponsor | Technology Used |
|---------|----------------|
| **Zama** | fhEVM — encrypted tallies (`euint8`, `euint128`), Gateway decryption |
| **Starknet** | Privacy-preserving governance showcase |
| **Ethereum Foundation** | New governance primitive for Ethereum DAOs |

## Roadmap

- [x] Core contracts (SealGovernor, SealTally, SealToken)
- [x] Hardhat deployment setup
- [x] Next.js frontend with brutalist design
- [x] Landing, Proposals, and Vote pages
- [x] Wagmi hooks for contract interaction
- [ ] fhevm.js SDK integration for browser-side encryption
- [ ] Filecoin archival for governance history
- [ ] ConfidentialERC20 for token balance privacy (V2)

## License

MIT

---

*SealFi — PL Genesis: Frontiers of Collaboration Hackathon*
