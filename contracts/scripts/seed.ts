import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  
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
  
  // Create proposals
  for (let i = 0; i < descriptions.length; i++) {
    const tx = await sealGovernor.propose(
      descriptions[i],
      targets[i],
      callDatas[i]
    );
    await tx.wait();
    console.log(`Created proposal #${i + 1}: ${descriptions[i]}`);
  }
  
  console.log("Seeding complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
