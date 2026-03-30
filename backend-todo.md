# SealFi Backend TODO

**Analysis Goal**: Compare the `sealfi-prd.md` requirements against the current state of the `contracts` directory to identify pending backend tasks.

## 1. Current State Evaluation

The core smart contracts have been implemented and actually adapted to the newer `TFHE` library (replacing `FHE` logic shown in the PRD).
- `SealGovernor.sol`: Implemented completely.
- `SealTally.sol`: Implemented completely.
- `SealToken.sol`: Implemented completely.
- `deploy.ts`: Implemented, properly links Governor and Tally.

## 2. Gap Analysis & Missing Items

While the core Solidity code matches the PRD, the overarching MVP requires specific behaviors for the demo, testing, and seeding that are not currently supported.

### A. Demo Timing Parameters
In `SealGovernor.sol`, the voting periods are hardcoded:
```solidity
uint256 public constant VOTING_PERIOD   = 3 days;
uint256 public constant VOTING_DELAY    = 1 days;
```
However, the **Demo Script** in the PRD (Section 24) explicitly requires a "Testnet proposal with 5-minute voting period."
**Action Required:** Modify these constants to be immutable variables set in the `constructor`, or create a `SealGovernorDemo.sol` that inherits and overrides these for testnet deployments.

### B. Seed Script State Generation
In the PRD (Sections 14 & 15), the UI requires three distinct proposal states for an accurate demo:
1. Closed & Passed Proposal (Tallies revealed)
2. Active Proposal (~1 day left)
3. Active Proposal (~2 days left)

`seed.ts` currently creates 3 identical proposals that all start and end at the exact same time (`PENDING` state).
**Action Required:** Update `seed.ts` to:
- Cast encrypted votes using fhEVM mocking/testing helpers to simulate a populated DAO.
- Manipulate `evm_increaseTime` if on a local testnet, or correctly stage the proposals with modified voting delays so that at least one proposal is fully closed, tallied, and executed by the time the seed script finishes.

### C. Testing Suite
The current repository completely lacks the `test/` directory. Given the complexity of Zama fhEVM, tests are vital.
**Action Required:** Create Hardhat tests to verify:
- Complete voting flow (Propose -> Vote -> Wait -> Tally -> Execute).
- Edge cases (e.g., trying to view tallies before close).
- Reverting conditions (voting twice, lacking tokens, insufficient quorum).

## 3. Recommended Todo List

- [ ] **Refactor `SealGovernor.sol` Time Parameters**: Update `VOTING_PERIOD` and `VOTING_DELAY` to be configurable upon deployment so the 5-minute demo constraint can be met.
- [ ] **Enhance `seed.ts`**:
  - Add logic to cast mock votes (e.g. 1 FOR, 1 AGAINST) using the FHE einput structures.
  - Implement time-skipping (using Hardhat network helpers if local, or a custom timing flag) to ensure the first proposal reaches the `EXECUTED` state with revealed tallies.
- [ ] **Implement Unit Tests (`test/SealGovernor.test.ts`)**: Write comprehensive tests to validate the encrypted voting flow and the tally gateway callback.
- [ ] **Gateway Callback Verification**: Ensure that the Zama Gateway decryption mocking is working correctly locally during testing and seeding.
