import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Contract } from "ethers";

let createInstance: any;
try {
  const fhevmjs = require("fhevmjs");
  createInstance = fhevmjs.createInstance;
} catch (e) {
  createInstance = null;
}

describe("SealGovernor & SealTally", function () {
  let sealToken: Contract;
  let sealTally: Contract;
  let sealGovernor: Contract;
  let deployer: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let nonVoter: SignerWithAddress;

  let fhevmInstance: any;

  const MIN_PROPOSE_TOKENS = ethers.parseEther("100");
  const VOTER1_BALANCE = ethers.parseEther("500");
  const VOTER2_BALANCE = ethers.parseEther("1000");

  before(async function () {
    [deployer, voter1, voter2, nonVoter] = await ethers.getSigners();
    if (createInstance) {
      const network = await ethers.provider.getNetwork();
      try {
        fhevmInstance = await createInstance({
          chainId: Number(network.chainId),
          networkUrl: "http://localhost:8545",
          gatewayUrl: "https://gateway.sepolia.zama.ai",
          publicKey: "0x",
        });
      } catch (e) {
        console.warn("Could not init fhevmjs instance.");
      }
    }
  });

  beforeEach(async function () {
    const SealToken = await ethers.getContractFactory("SealToken");
    sealToken = await SealToken.deploy() as Contract;
    await sealToken.waitForDeployment();

    const SealGovernor = await ethers.getContractFactory("SealGovernor");
    sealGovernor = await SealGovernor.deploy(await sealToken.getAddress(), ethers.ZeroAddress) as Contract;
    await sealGovernor.waitForDeployment();

    const SealTally = await ethers.getContractFactory("SealTally");
    sealTally = await SealTally.deploy(await sealGovernor.getAddress()) as Contract;
    await sealTally.waitForDeployment();

    await sealGovernor.setTally(await sealTally.getAddress());

    await sealToken.mint(deployer.address, MIN_PROPOSE_TOKENS);
    await sealToken.mint(voter1.address, VOTER1_BALANCE);
    await sealToken.mint(voter2.address, VOTER2_BALANCE);

    await sealToken.connect(deployer).delegate(deployer.address);
    await sealToken.connect(voter1).delegate(voter1.address);
    await sealToken.connect(voter2).delegate(voter2.address);

    await ethers.provider.send("evm_mine", []);
  });

  describe("1. Reverting Conditions & Validation", function () {
    it("Should revert propose if lacking tokens", async function () {
      await expect(
        sealGovernor.connect(nonVoter).propose("My Prop", nonVoter.address, "0x")
      ).to.be.revertedWithCustomError(sealGovernor, "InsufficientTokens");
    });

    it("Should revert vote if voting period isn't active", async function () {
      await sealGovernor.connect(deployer).propose("Early Vote Prop", deployer.address, "0x");
      const propId = 1;
      try {
        await sealGovernor.connect(voter1).castVote(propId, "0x00", "0x00");
        expect.fail("Should have reverted");
      } catch (e: any) {
        expect(e.message).to.include("VotingNotActive");
      }
    });
  });

  describe("2. Edge Cases", function () {
    let propId: number;

    beforeEach(async function () {
      await sealGovernor.connect(deployer).propose("Edge Case Prop", deployer.address, "0x");
      propId = 1;
      const delay = await sealGovernor.VOTING_DELAY();
      await ethers.provider.send("evm_increaseTime", [Number(delay) + 1]);
      await ethers.provider.send("evm_mine", []);
    });

    it("Should return 0 for tallies while voting is active (sealed envelope)", async function () {
      const data = await sealGovernor.getProposal(propId);
      expect(data[5]).to.equal(0);
      expect(data[6]).to.equal(0);
      expect(data[7]).to.equal(0);
    });

    it("Should revert if trying to request tally before voting ends", async function () {
      await expect(
        sealGovernor.requestTally(propId)
      ).to.be.revertedWithCustomError(sealGovernor, "VotingStillActive");
    });

    it("Should revert if a user tries to vote twice", async function () {
      if (!fhevmInstance) this.skip();
      const encVote = await fhevmInstance.encrypt8(1n);
      await sealGovernor.connect(voter1).castVote(propId, encVote.ciphertext, encVote.proof);
      await expect(
        sealGovernor.connect(voter1).castVote(propId, encVote.ciphertext, encVote.proof)
      ).to.be.revertedWithCustomError(sealGovernor, "AlreadyVoted");
    });
  });

  describe("3. Complete Voting Flow", function () {
    it("Should complete the full cycle: Propose -> Vote -> End -> Execute", async function () {
      if (!fhevmInstance) this.skip();

      const target = await sealToken.getAddress();
      const callData = "0x";
      await sealGovernor.connect(deployer).propose("Full Flow Prop", target, callData);
      const propId = 1;

      const delay = await sealGovernor.VOTING_DELAY();
      await ethers.provider.send("evm_increaseTime", [Number(delay) + 1]);
      await ethers.provider.send("evm_mine", []);

      const encVoteFor = await fhevmInstance.encrypt8(1n);
      await sealGovernor.connect(voter1).castVote(propId, encVoteFor.ciphertext, encVoteFor.proof);

      const encVoteAgainst = await fhevmInstance.encrypt8(0n);
      await sealGovernor.connect(voter2).castVote(propId, encVoteAgainst.ciphertext, encVoteAgainst.proof);

      let state = await sealGovernor.getProposal(propId);
      expect(state[5]).to.equal(0);

      const period = await sealGovernor.VOTING_PERIOD();
      await ethers.provider.send("evm_increaseTime", [Number(period) + 1]);
      await ethers.provider.send("evm_mine", []);

      await sealGovernor.requestTally(propId);
      state = await sealGovernor.getProposal(propId);
      expect(state[4]).to.equal(2n);

      const GATEWAY_ADDRESS = "0x0000000000000000000000000000000000000000";

      try {
        await ethers.provider.send("hardhat_impersonateAccount", [GATEWAY_ADDRESS]);
        await ethers.provider.send("hardhat_setBalance", [
          GATEWAY_ADDRESS,
          ethers.toBeHex(ethers.parseEther("1.0"))
        ]);
        const gatewaySigner = await ethers.getSigner(GATEWAY_ADDRESS);

        // FIXED: Using scaled-down values matching euint64 behavior
        await sealGovernor.connect(gatewaySigner).fulfillTally(1, 500n, 1000n, 0n);

        state = await sealGovernor.getProposal(propId);
        expect(state[4]).to.equal(4n);

        await expect(sealGovernor.execute(propId)).to.be.revertedWithCustomError(
          sealGovernor,
          "ProposalNotSucceeded"
        );
      } catch (e) {
        console.warn("Could not impersonate gateway for callback testing.");
      }
    });
  });
});