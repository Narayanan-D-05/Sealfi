import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log(`\n🚀 Starting Quadratic Voting Demo on chain ${network.chainId}`);
  console.log(`👤 Operator: ${deployer.address}`);

  // Load deployment addresses
  const deploymentPath = path.join(__dirname, "..", "deployment.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("deployment.json not found. Please run deploy script first.");
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  
  const tokenAddr = deployment.contracts.SealToken;
  const governorAddr = deployment.contracts.SealGovernor;

  console.log(`\n🔗 Connecting to contracts...`);
  console.log(`   SealToken:    ${tokenAddr}`);
  console.log(`   SealGovernor: ${governorAddr}`);

  const SealToken = await ethers.getContractAt("SealToken", tokenAddr);
  const SealGovernor = await ethers.getContractAt("SealGovernor", governorAddr);

  // 1. Check Deployer Balance and Power
  console.log(`\n📊 Checking Quadratic Power for Deployer...`);
  const rawBalance = await SealToken.balanceOf(deployer.address);
  console.log(`   Raw Balance:    ${ethers.formatEther(rawBalance)} SEAL`);
  
  // Calculate Quadratic Power: sqrt(balance * 1e18)
  // In BigInt math:
  let effectivePower = 0n;
  if (rawBalance > 0n) {
    // Babylon method for BigInt sqrt
    let x = (rawBalance * 10n**18n) / 2n + 1n;
    let y = (x + (rawBalance * 10n**18n) / x) / 2n;
    while (y < x) {
      x = y;
      y = (x + (rawBalance * 10n**18n) / x) / 2n;
    }
    effectivePower = x;
  }
  
  console.log(`   🚨 QUAD_POWER:   ${ethers.formatEther(effectivePower)} SEAL (Effective Votes)`);

  // 2. Delegate to Self (if not already) to activate voting power
  // Note: we can't easily check delegates in this simple script without hitting the mapping, 
  // but we can just delegate anyway to be safe.
  console.log(`\n⚡ Activating Voting Power (Self-Delegation)...`);
  try {
    const delegateTx = await SealToken.delegate(deployer.address);
    await delegateTx.wait(1);
    console.log(`   ✓ Delegation confirmed.`);
  } catch (error: any) {
    console.log(`   ! Delegation issue (might already be delegated): ${error.message}`);
  }

  // 3. Create Genesis Proposal
  console.log(`\n📜 Creating Genesis Proposal...`);
  
  const description = "Genesis Proposal: Activate Enclave 01 (Quadratic Voting)";
  // We'll just propose a dummy call, e.g., transferring 0 tokens to the zero address
  // using the token contract as the target for a harmless call
  const target = tokenAddr;
  const callData = SealToken.interface.encodeFunctionData("transfer", [ethers.ZeroAddress, 0]);

  try {
    const proposeTx = await SealGovernor.propose(description, target, callData);
    const receipt = await proposeTx.wait(1);
    
    // Extract Proposal ID from events
    const filter = SealGovernor.filters.ProposalCreated();
    // @ts-ignore
    const events = await SealGovernor.queryFilter(filter, receipt?.blockNumber, receipt?.blockNumber);
    
    if (events.length > 0) {
      // @ts-ignore
      const proposalId = events[0].args.proposalId;
      console.log(`   ✅ Genesis Proposal Created!`);
      console.log(`   📌 Proposal ID: ${proposalId.toString()}`);
    } else {
      console.log(`   ✅ Genesis Proposal Created (Transaction successful, but unable to parse event).`);
    }
  } catch (error: any) {
     console.error(`   ❌ Failed to create proposal. Ensure you have activated voting power and threshold is met. Error:`, error.message);
  }

  // 4. Demonstrate small holder power vs whale power
  console.log(`\n⚖️ Power Comparison Demo...`);
  const whaleBalance = 1000000n * 10n**18n; // 1,000,000 SEAL
  const smallBalance = 100n * 10n**18n;     // 100 SEAL
  
  const whaleSqrt = BigInt(Math.trunc(Math.sqrt(Number(whaleBalance / 10n**18n))));
  const smallSqrt = BigInt(Math.trunc(Math.sqrt(Number(smallBalance / 10n**18n))));

  console.log(`   Whale Profile (1,000,000 SEAL):`);
  console.log(`      Raw Balance:  1,000,000 SEAL`);
  console.log(`      QUAD_POWER:   ${whaleSqrt} SEAL`);
  
  console.log(`   Small Holder (100 SEAL):`);
  console.log(`      Raw Balance:  100 SEAL`);
  console.log(`      QUAD_POWER:   ${smallSqrt} SEAL`);
  
  console.log(`\n   > The whale has 10,000x more tokens, but only 100x more voting power.`);

  console.log(`\n🎉 Demo setup complete. You can now visit your frontend and check the active proposal!`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
