import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Creates a fresh governance proposal on the already-deployed contracts.
 * Usage: npx hardhat run scripts/new-proposal.ts --network sepolia
 */
async function main() {
  const deploymentPath = path.join(__dirname, "..", "scripts", "deployment.json");
  const altPath = path.join(__dirname, "..", "deployment.json");
  const usePath = fs.existsSync(altPath) ? altPath : deploymentPath;

  const deployment = JSON.parse(fs.readFileSync(usePath, "utf-8"));
  const { SealToken: tokenAddr, SealGovernor: governorAddr } = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const confirms = network.chainId === 11155111n ? 2 : 1;

  console.log(`\n📝  Creating new proposal on chain ${network.chainId}`);
  console.log(`    Proposer: ${deployer.address}\n`);

  const sealGovernor = await ethers.getContractAt("SealGovernor", governorAddr);

  // Make sure deployer has tokens and has delegated (required to propose)
  const sealToken = await ethers.getContractAt("SealToken", tokenAddr);
  const balance = await sealToken.balanceOf(deployer.address);
  if (balance === 0n) {
    console.log("  Minting 10,000 SEAL to deployer...");
    const mintTx = await sealToken.mint(deployer.address, ethers.parseEther("10000"));
    await mintTx.wait(confirms);
  }

  const delegatee = await sealToken.delegates(deployer.address);
  if (delegatee === ethers.ZeroAddress || delegatee.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  Self-delegating voting power...");
    const delTx = await sealToken.delegate(deployer.address);
    await delTx.wait(confirms);
    console.log("  Waiting 15s for checkpoint to settle...");
    await new Promise(r => setTimeout(r, 15_000));
  }

  // Create the proposal with full structured description
  const proposalDescription = [
    "Transfer Protocol Governance & Minting Authority",
    "",
    "This proposal initiates the transfer of the setGovernance authority and minting keys of the BUILD token contract to the designated unilateral management address.",
    "",
    "OPTIONS:",
    "FOR     — Approve the transfer of full governance, treasury, and minting control to the new address.",
    "AGAINST — Reject the proposal and maintain the current multi-stage governance structure.",
    "ABSTAIN — Record presence without voting on the outcome.",
  ].join("\n");

  console.log(`  Creating: "Transfer Protocol Governance & Minting Authority"`);
  const proposeTx = await sealGovernor.propose(proposalDescription, tokenAddr, "0x");
  const receipt = await proposeTx.wait(confirms);

  console.log(`\n✅  Proposal created!`);
  console.log(`   Tx Hash: ${receipt?.hash}`);
  console.log(`\n   ➡ Go to http://localhost:3000/proposals and vote on the new proposal!`);
  console.log(`   ⏳ Voting opens in ~1 minute (VOTING_DELAY), closes in ~5 minutes (VOTING_PERIOD)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
