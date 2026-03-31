import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import hre from "hardhat";

/**
 * SealGovernor & SealTally — Full On-Chain Test Suite
 *
 * Stack: @fhevm/solidity 0.11.x + @fhevm/hardhat-plugin 0.4.x
 *
 * Encryption approach:
 *   hre.fhevm.createEncryptedInput(contractAddr, userAddr) → RelayerEncryptedInput
 *   input.add8(1n) → encVote for FOR, input.add8(0n) → AGAINST, etc.
 *   input.encrypt() → { handles, inputProof }
 *
 * Decryption approach (public tally after requestTally):
 *   hre.fhevm.publicDecryptEuint(FhevmType.euint128, handle, ...) → bigint
 *
 * Block-snapshot fix:
 *   After minting + delegating we mine 2 extra blocks so that getPastVotes
 *   at (block.number - 1) finds a valid checkpoint.
 */
describe("SealGovernor & SealTally", function () {
  let sealToken: any;
  let sealTally: any;
  let sealGovernor: any;
  let deployer: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let voter3: SignerWithAddress;
  let nonVoter: SignerWithAddress;

  const PROPOSE_TOKENS = ethers.parseEther("100");
  const V1_BALANCE     = ethers.parseEther("500");
  const V2_BALANCE     = ethers.parseEther("1000");
  const V3_BALANCE     = ethers.parseEther("200");

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Advances the local Hardhat clock by `seconds` without mining
   * then mines one block to apply the timestamp change.
   */
  async function advanceTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  /**
   * Encrypt an 8-bit vote for `voter` targeting `sealGovernor`.
   * Returns { handles, inputProof } ready for castVote().
   */
  async function encryptVote(voter: SignerWithAddress, direction: 0 | 1 | 2) {
    // FHE.fromExternal is called in SealGovernor.castVote (msg.sender = voter),
    // so we bind the encrypted input to SealGovernor's address.
    const governorAddr = await sealGovernor.getAddress();
    const input = hre.fhevm.createEncryptedInput(governorAddr, voter.address);
    input.add8(BigInt(direction));
    return input.encrypt();
  }

  // ─── Shared Setup ──────────────────────────────────────────────────────────

  beforeEach(async function () {
    [deployer, voter1, voter2, voter3, nonVoter] = await ethers.getSigners();

    // Deploy SealToken
    const SealTokenF = await ethers.getContractFactory("SealToken");
    sealToken = await SealTokenF.deploy();
    await sealToken.waitForDeployment();

    // Deploy SealGovernor (tally = zero address; will be set after)
    const SealGovernorF = await ethers.getContractFactory("SealGovernor");
    sealGovernor = await SealGovernorF.deploy(
      await sealToken.getAddress(),
      ethers.ZeroAddress
    );
    await sealGovernor.waitForDeployment();

    // Deploy SealTally pointing at governor
    const SealTallyF = await ethers.getContractFactory("SealTally");
    sealTally = await SealTallyF.deploy(await sealGovernor.getAddress());
    await sealTally.waitForDeployment();

    // Wire tally into governor
    await sealGovernor.setTally(await sealTally.getAddress());

    // Mint tokens
    await sealToken.mint(deployer.address, PROPOSE_TOKENS);
    await sealToken.mint(voter1.address,   V1_BALANCE);
    await sealToken.mint(voter2.address,   V2_BALANCE);
    await sealToken.mint(voter3.address,   V3_BALANCE);

    // Self-delegate so votes are checkpointed
    await sealToken.connect(deployer).delegate(deployer.address);
    await sealToken.connect(voter1).delegate(voter1.address);
    await sealToken.connect(voter2).delegate(voter2.address);
    await sealToken.connect(voter3).delegate(voter3.address);

    // Mine 2 extra blocks so block.number-1 checkpoint exists at propose time
    await ethers.provider.send("evm_mine", []);
    await ethers.provider.send("evm_mine", []);
  });

  // ─── 1. Reverting Conditions & Validation ──────────────────────────────────

  describe("1. Reverting Conditions & Validation", function () {
    it("Should revert propose if account lacks PROPOSAL_THRESHOLD tokens", async function () {
      // nonVoter has 0 tokens → should revert
      await expect(
        sealGovernor.connect(nonVoter).propose("Bad Prop", nonVoter.address, "0x")
      ).to.be.reverted;
    });

    it("Should revert castVote outside the voting window (PENDING state)", async function () {
      await sealGovernor.connect(deployer).propose("Vote Too Early", deployer.address, "0x");
      const propId = 1n;

      const enc = await encryptVote(voter1, 1);
      await expect(
        sealGovernor.connect(voter1).castVote(propId, enc.handles[0], enc.inputProof)
      ).to.be.revertedWithCustomError(sealGovernor, "VotingNotActive");
    });

    it("Should revert requestTally while voting is still active", async function () {
      await sealGovernor.connect(deployer).propose("Active Prop", deployer.address, "0x");
      const propId = 1n;

      // Move into the voting window but not past it
      const delay = await sealGovernor.VOTING_DELAY();
      await advanceTime(Number(delay) + 1);

      await expect(
        sealGovernor.requestTally(propId)
      ).to.be.revertedWithCustomError(sealGovernor, "VotingStillActive");
    });

    it("Should revert if a voter tries to vote twice", async function () {
      await sealGovernor.connect(deployer).propose("Double Vote Prop", deployer.address, "0x");
      const propId = 1n;

      const delay = await sealGovernor.VOTING_DELAY();
      await advanceTime(Number(delay) + 1);

      const enc1 = await encryptVote(voter1, 1);
      await sealGovernor.connect(voter1).castVote(propId, enc1.handles[0], enc1.inputProof);

      const enc2 = await encryptVote(voter1, 0);
      await expect(
        sealGovernor.connect(voter1).castVote(propId, enc2.handles[0], enc2.inputProof)
      ).to.be.revertedWithCustomError(sealGovernor, "AlreadyVoted");
    });

    it("Should revert if non-token-holder tries to vote", async function () {
      await sealGovernor.connect(deployer).propose("No Tokens Prop", deployer.address, "0x");
      const propId = 1n;

      const delay = await sealGovernor.VOTING_DELAY();
      await advanceTime(Number(delay) + 1);

      const enc = await encryptVote(nonVoter, 1);
      await expect(
        sealGovernor.connect(nonVoter).castVote(propId, enc.handles[0], enc.inputProof)
      ).to.be.revertedWithCustomError(sealGovernor, "InsufficientTokens");
    });
  });

  // ─── 2. Edge Cases ─────────────────────────────────────────────────────────

  describe("2. Edge Cases", function () {
    it("Tally should be zero while voting is active (sealed envelope)", async function () {
      await sealGovernor.connect(deployer).propose("Sealed Prop", deployer.address, "0x");
      const propId = 1n;

      const data = await sealGovernor.getProposal(propId);
      // forVotes, againstVotes, abstainVotes are all 0 until tally is fulfilled
      expect(data.forVotes ?? data[5]).to.equal(0n);
      expect(data.againstVotes ?? data[6]).to.equal(0n);
      expect(data.abstainVotes ?? data[7]).to.equal(0n);
    });

    it("sealTally.isDecryptionRequested() should be false before requestTally", async function () {
      await sealGovernor.connect(deployer).propose("Before Tally", deployer.address, "0x");
      const propId = 1n;
      expect(await sealTally.isDecryptionRequested(propId)).to.be.false;
    });

    it("Should revert requestTally twice on the same proposal", async function () {
      await sealGovernor.connect(deployer).propose("Double Tally", deployer.address, "0x");
      const propId = 1n;

      const delay  = await sealGovernor.VOTING_DELAY();
      const period = await sealGovernor.VOTING_PERIOD();
      await advanceTime(Number(delay) + Number(period) + 1);

      await sealGovernor.requestTally(propId);
      await expect(
        sealGovernor.requestTally(propId)
      ).to.be.revertedWithCustomError(sealGovernor, "TallyAlreadyRequested");
    });
  });

  // ─── 3. Complete Voting Flow ────────────────────────────────────────────────

  describe("3. Complete Voting Flow", function () {
    it("Should complete: Propose → Vote (FOR all) → requestTally → publicDecrypt → fulfillTally → Succeeded", async function () {
      // 3a — Propose
      await sealGovernor.connect(deployer).propose(
        "Full Flow: Everyone votes FOR",
        await sealToken.getAddress(),
        "0x"
      );
      const propId = 1n;

      let data = await sealGovernor.getProposal(propId);
      // State: PENDING = 0
      expect(data[4]).to.equal(0n);

      // 3b — Advance into voting window
      const delay = await sealGovernor.VOTING_DELAY();
      await advanceTime(Number(delay) + 1);

      // 3c — Cast encrypted FOR votes (direction = 1)
      const enc1 = await encryptVote(voter1, 1);
      await sealGovernor.connect(voter1).castVote(propId, enc1.handles[0], enc1.inputProof);

      const enc2 = await encryptVote(voter2, 1);
      await sealGovernor.connect(voter2).castVote(propId, enc2.handles[0], enc2.inputProof);

      // Intermediate check: tally still encrypted (forVotes = 0 in clear state)
      data = await sealGovernor.getProposal(propId);
      expect(data[5]).to.equal(0n); // forVotes clear-text not yet revealed

      // State should be ACTIVE = 1
      expect(data[4]).to.equal(1n);

      // 3d — End voting period
      const period = await sealGovernor.VOTING_PERIOD();
      await advanceTime(Number(period) + 1);

      // 3e — Request tally (marks handles as publicly decryptable)
      await sealGovernor.requestTally(propId);
      data = await sealGovernor.getProposal(propId);
      // State: TALLYING = 2
      expect(data[4]).to.equal(2n);
      expect(await sealTally.isDecryptionRequested(propId)).to.be.true;

      // 3f — Fetch encrypted handles from SealTally
      const handles = await sealTally.getTallyHandles(propId);
      const forHandle     = handles[0];
      const againstHandle = handles[1];
      const abstainHandle = handles[2];

      // 3g — Public decrypt via mock coprocessor (works on local Hardhat)
      const { FhevmType } = await import("@fhevm/hardhat-plugin");
      const forVotes     = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, forHandle);
      const againstVotes = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, againstHandle);
      const abstainVotes = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, abstainHandle);

      // voter1 = 500e18, voter2 = 1000e18, both voted FOR
      expect(forVotes).to.equal(V1_BALANCE + V2_BALANCE);
      expect(againstVotes).to.equal(0n);
      expect(abstainVotes).to.equal(0n);

      // 3h — Submit clear-text tally to governor
      await sealGovernor.fulfillTally(propId, forVotes, againstVotes, abstainVotes);
      data = await sealGovernor.getProposal(propId);

      // State: SUCCEEDED = 3
      expect(data[4]).to.equal(3n);
      expect(data[5]).to.equal(forVotes);
    });

    it("Should end as DEFEATED when against > for", async function () {
      await sealGovernor.connect(deployer).propose(
        "Defeated Proposal",
        await sealToken.getAddress(),
        "0x"
      );
      const propId = 1n;

      const delay = await sealGovernor.VOTING_DELAY();
      await advanceTime(Number(delay) + 1);

      // voter1 (500 SEAL) votes FOR, voter2 (1000 SEAL) votes AGAINST
      const enc1 = await encryptVote(voter1, 1);
      await sealGovernor.connect(voter1).castVote(propId, enc1.handles[0], enc1.inputProof);

      const enc2 = await encryptVote(voter2, 0);
      await sealGovernor.connect(voter2).castVote(propId, enc2.handles[0], enc2.inputProof);

      const period = await sealGovernor.VOTING_PERIOD();
      await advanceTime(Number(period) + 1);

      await sealGovernor.requestTally(propId);

      const handles = await sealTally.getTallyHandles(propId);
      const { FhevmType } = await import("@fhevm/hardhat-plugin");
      const forVotes     = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, handles[0]);
      const againstVotes = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, handles[1]);
      const abstainVotes = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, handles[2]);

      await sealGovernor.fulfillTally(propId, forVotes, againstVotes, abstainVotes);

      const data = await sealGovernor.getProposal(propId);
      // State: DEFEATED = 4
      expect(data[4]).to.equal(4n);
    });

    it("Should execute a succeeded proposal", async function () {
      // Propose a harmless read-only call — SealToken.totalSupply() always succeeds
      const callData = sealToken.interface.encodeFunctionData("totalSupply");
      await sealGovernor.connect(deployer).propose(
        "Executable Proposal",
        await sealToken.getAddress(),
        callData
      );
      const propId = 1n;

      const delay = await sealGovernor.VOTING_DELAY();
      await advanceTime(Number(delay) + 1);

      // All three voters vote FOR
      for (const voter of [voter1, voter2, voter3]) {
        const enc = await encryptVote(voter, 1);
        await sealGovernor.connect(voter).castVote(propId, enc.handles[0], enc.inputProof);
      }

      const period = await sealGovernor.VOTING_PERIOD();
      await advanceTime(Number(period) + 1);

      await sealGovernor.requestTally(propId);

      const handles = await sealTally.getTallyHandles(propId);
      const { FhevmType } = await import("@fhevm/hardhat-plugin");
      const forVotes     = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, handles[0]);
      const againstVotes = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, handles[1]);
      const abstainVotes = await hre.fhevm.publicDecryptEuint(FhevmType.euint128, handles[2]);

      await sealGovernor.fulfillTally(propId, forVotes, againstVotes, abstainVotes);

      // Proposal must be SUCCEEDED to execute
      const dataBefore = await sealGovernor.getProposal(propId);
      expect(dataBefore[4]).to.equal(3n); // SUCCEEDED

      await expect(sealGovernor.execute(propId))
        .to.emit(sealGovernor, "ProposalExecuted")
        .withArgs(propId);

      const dataAfter = await sealGovernor.getProposal(propId);
      expect(dataAfter[4]).to.equal(5n); // EXECUTED
    });
  });
});
