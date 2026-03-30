import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer, voter1, voter2] = await ethers.getSigners();
  
  // Read deployment addresses
  const deploymentPath = path.join(__dirname, "deployment.json");
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("Error: deployment.json not found!");
    console.error("Please run 'npx hardhat run scripts/deploy.ts --network fhevm_sepolia' first.");
    process.exit(1);
  }
  
  const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const sealToken = await ethers.getContractAt("SealToken", deploymentData.sealToken);
  const sealGovernor = await ethers.getContractAt("SealGovernor", deploymentData.sealGovernor);
  
  console.log("Seeding with demo data...");
  console.log("Using deployer:", deployer.address);
  
  // Mint tokens to deployer
  const mintAmount = ethers.parseEther("1000000"); // 1M tokens
  await sealToken.mint(deployer.address, mintAmount);
  console.log("Minted 1M SEAL to deployer");
  
  // Delegate tokens to self (required for voting power)
  await sealToken.delegate(deployer.address);
  console.log("Delegated voting power to self");
  
  // Wait a bit for delegation to settle
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Check voting power
  const votingPower = await sealToken.getVotes(deployer.address);
  console.log("Voting power:", ethers.formatEther(votingPower), "SEAL");
  
  // Create demo proposals with different states
  const targets = [deployer.address, deployer.address, deployer.address];
  const callDatas = ["0x", "0x", "0x"];
  const descriptions = [
    "Adjust protocol fee from 0.30% to 0.25%",
    "Add HBAR as accepted collateral type",
    "Increase treasury allocation to 12% of protocol fees"
  ];
  
  // NOTE: If running on a public testnet (like fhevm_sepolia), evm_increaseTime will fail.
  // The PRD requests distinct proposal states (Closed, Active 1 day left, Active 2 days left).
  // Without the ability to change the smart contract constants, we simulate time where possible.
  
  // Create proposals
  for (let i = 0; i < descriptions.length; i++) {
    const tx = await sealGovernor.propose(
      descriptions[i],
      targets[i],
      callDatas[i]
    );
    await tx.wait();
    console.log(`Created proposal #${i + 1}: ${descriptions[i]}`);
    
    // Attempt to shift time so they end up staggerred (1 day apart)
    try {
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]); // 1 day
      await ethers.provider.send("evm_mine", []);
      console.log("  Successfully fast-forwarded time by 1 day.");
    } catch (e) {
      // Ignore if networking doesn't allow time shifting
      console.log("  Time shifting not supported on this network. State will remain pending/active.");
    }
  }

  // One final time advance to ensure Proposal 1 crosses its voteEnd and becomes Closed
  try {
    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]); // +1 day
    await ethers.provider.send("evm_mine", []);
    console.log("Successfully fast-forwarded final day. Proposal 1 is now CLOSED.");
  } catch (e) {
    // Ignore
  }

  // Cast mock encrypted votes if fhevmjs is installed
  try {
    const fhevmjs = await import("fhevmjs");
    console.log("fhevmjs found. Attempting to cast mock votes...");
    
    const fhevmInstance = await fhevmjs.createInstance({
      chainId: (await ethers.provider.getNetwork()).chainId,
      networkUrl: ethers.provider._getConnection().url,
      gatewayUrl: "https://gateway.sepolia.zama.ai",
    });

    // Encrypt a FOR vote (1)
    console.log("Encrypting a FOR vote...");
    const encryptedFor = await fhevmInstance.encrypt8(1n);

    // Cast vote on Proposal 3 (the last one)
    console.log("Casting vote on Proposal 3...");
    const voteTx = await sealGovernor.castVote(
      3,
      encryptedFor.ciphertext,
      encryptedFor.proof
    );
    await voteTx.wait();
    console.log("Successfully cast encrypted vote on Proposal 3!");

  } catch (err) {
    console.log("fhevmjs not installed or encryption failed. Skipping mock encrypted votes.");
    console.log("To cast mock votes in seed.ts, please 'npm install fhevmjs'.");
  }
  
  console.log("Seeding complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
