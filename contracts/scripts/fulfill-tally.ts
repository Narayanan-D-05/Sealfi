import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Fulfills the tally for a proposal that is in TALLYING state.
 * Since we used castVotePlain(), the vote counts are already stored in the
 * proposal struct. We just need to read them back and pass them to fulfillTally()
 * to transition the proposal to SUCCEEDED or DEFEATED.
 *
 * Usage:
 *   PROPOSAL_ID=1 npx hardhat run scripts/fulfill-tally.ts --network sepolia
 *   or just: npx hardhat run scripts/fulfill-tally.ts --network sepolia  (defaults to proposal 1)
 */
async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const { SealGovernor: governorAddr } = deployment.contracts;

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const confirms = network.chainId === 11155111n ? 2 : 1;

  const proposalId = BigInt(process.env.PROPOSAL_ID || "1");

  console.log(`\n🔓  Fulfilling tally for Proposal #${proposalId}`);
  console.log(`    Network:  ${network.name} (chainId: ${network.chainId})`);
  console.log(`    Deployer: ${deployer.address}\n`);

  const sealGovernor = await ethers.getContractAt("SealGovernor", governorAddr);

  // Read current on-chain vote tallies (already set by castVotePlain)
  const prop = await sealGovernor.getProposal(proposalId);
  const [proposer, description, voteStart, voteEnd, state, forVotes, againstVotes, abstainVotes] = prop;

  const STATE_NAMES = ["PENDING", "ACTIVE", "TALLYING", "SUCCEEDED", "DEFEATED", "EXECUTED"];
  console.log(`  Proposal:      "${description}"`);
  console.log(`  Current State: ${STATE_NAMES[Number(state)] || state}`);
  console.log(`  FOR Votes:     ${ethers.formatEther(forVotes)} QUAD_WEIGHT`);
  console.log(`  AGAINST Votes: ${ethers.formatEther(againstVotes)} QUAD_WEIGHT`);
  console.log(`  ABSTAIN Votes: ${ethers.formatEther(abstainVotes)} QUAD_WEIGHT\n`);

  if (Number(state) !== 2) {
    console.error(`  ❌ Proposal is in state ${STATE_NAMES[Number(state)]} — must be TALLYING (2) to fulfill.`);
    process.exit(1);
  }

  console.log("  Calling fulfillTally()...");
  const tx = await sealGovernor.fulfillTally(proposalId, forVotes, againstVotes, abstainVotes);
  console.log(`  TX: ${tx.hash}`);
  await tx.wait(confirms);

  // Read final state
  const finalProp = await sealGovernor.getProposal(proposalId);
  const finalState = Number(finalProp[4]);
  const finalStateName = STATE_NAMES[finalState] || finalState;

  console.log(`\n✅  Tally fulfilled!`);
  console.log(`   Final State: ${finalStateName}`);
  console.log(`   FOR:         ${ethers.formatEther(finalProp[5])} QUAD_WEIGHT`);
  console.log(`   AGAINST:     ${ethers.formatEther(finalProp[6])} QUAD_WEIGHT`);
  console.log(`   ABSTAIN:     ${ethers.formatEther(finalProp[7])} QUAD_WEIGHT`);
  console.log(`\n   ➡ Refresh http://localhost:3000/vote/${proposalId} to see results!\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
