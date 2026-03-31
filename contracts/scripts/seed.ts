import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import hre from "hardhat";

/**
 * SealFi Seed Script
 *
 * Seeds the deployed contracts with:
 *   1. Mints SEAL tokens to test voters.
 *   2. Each voter self-delegates.
 *   3. Creates a test proposal.
 *   4. Casts encrypted votes using @fhevm/hardhat-plugin (real on-chain encryption).
 *
 * Usage:
 *   npx hardhat run scripts/seed.ts --network sepolia
 *
 * Prerequisites:
 *   - deployment.json must exist (run deploy.ts first).
 *   - DEPLOYER_PRIVATE_KEY must hold enough ETH.
 */
async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("deployment.json not found — run deploy.ts first");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const { SealToken: tokenAddr, SealGovernor: governorAddr } = deployment.contracts;

  const [deployer, voter1, voter2, voter3] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const isSepolia = network.chainId === 11155111n;
  const confirms  = isSepolia ? 2 : 1;

  console.log(`\n🌱  Seeding SealFi on chain ${network.chainId}`);
  console.log(`    Deployer:  ${deployer.address}\n`);

  const sealToken    = await ethers.getContractAt("SealToken",    tokenAddr);
  const sealGovernor = await ethers.getContractAt("SealGovernor", governorAddr);

  const MINT_AMOUNT = ethers.parseEther("1000");

  // ── 1. Mint & Delegate ────────────────────────────────────────────────────
  for (const voter of [voter1, voter2, voter3]) {
    console.log(`  Minting ${ethers.formatEther(MINT_AMOUNT)} SEAL → ${voter.address}`);
    const mintTx = await sealToken.mint(voter.address, MINT_AMOUNT);
    await mintTx.wait(confirms);

    const delTx = await sealToken.connect(voter).delegate(voter.address);
    await delTx.wait(confirms);
    console.log(`  Delegated self for ${voter.address}`);
  }

  // Allow checkpoint to settle on Sepolia (2 blocks minimum)
  if (isSepolia) {
    console.log("\n  Waiting for checkpoint settlement (15s)...");
    await new Promise(r => setTimeout(r, 15_000));
  }

  // ── 2. Propose ────────────────────────────────────────────────────────────
  console.log("\n  Creating test proposal...");
  const proposeTx = await sealGovernor.connect(deployer).propose(
    "Seed Proposal: Enable Confidential Treasury Transfers",
    tokenAddr,
    "0x"
  );
  await proposeTx.wait(confirms);
  const propId = 1n;
  console.log(`  ✓ Proposal #${propId} created\n`);

  // ── 3. Wait for voting delay ──────────────────────────────────────────────
  const prop     = await sealGovernor.getProposal(propId);
  const voteStart = Number(prop.voteStart ?? prop[2]);
  const now       = Math.floor(Date.now() / 1000);

  if (voteStart > now) {
    const wait = voteStart - now + 5;
    console.log(`  ⏳ Waiting ${wait}s for voting window to open...`);
    await new Promise(r => setTimeout(r, wait * 1000));
  }

  // ── 4. Cast Encrypted Votes ───────────────────────────────────────────────
  const directions: [any, 0 | 1 | 2][] = [
    [voter1, 1], // FOR
    [voter2, 1], // FOR
    [voter3, 0], // AGAINST
  ];

  for (const [voter, direction] of directions) {
    console.log(`  Encrypting vote (direction=${direction}) for ${voter.address}`);
    const input = hre.fhevm.createEncryptedInput(governorAddr, voter.address);
    input.add8(BigInt(direction));
    const enc = await input.encrypt();

    const voteTx = await sealGovernor
      .connect(voter)
      .castVote(propId, enc.handles[0], enc.inputProof);
    await voteTx.wait(confirms);
    console.log(`  ✓ Vote cast by ${voter.address}`);
  }

  console.log("\n✅  Seed complete!");
  console.log("   Next: wait for voting period to end, then call:");
  console.log("         await sealGovernor.requestTally(1)");
  console.log("         → get clear-text via hre.fhevm.publicDecryptEuint()");
  console.log("         → await sealGovernor.fulfillTally(1, for, against, abstain)\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
