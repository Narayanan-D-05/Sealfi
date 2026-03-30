import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy SealToken
  const SealToken = await ethers.getContractFactory("SealToken");
  const sealToken = await SealToken.deploy();
  await sealToken.waitForDeployment();
  const sealTokenAddress = await sealToken.getAddress();
  console.log("SealToken deployed to:", sealTokenAddress);

  // 2. Deploy SealGovernor (placeholder Tally)
  const SealGovernor = await ethers.getContractFactory("SealGovernor");
  const sealGovernor = await SealGovernor.deploy(sealTokenAddress, ethers.ZeroAddress);
  await sealGovernor.waitForDeployment();
  const sealGovernorAddress = await sealGovernor.getAddress();
  console.log("SealGovernor deployed to:", sealGovernorAddress);

  // 3. Deploy SealTally with correct Governor address
  const SealTally = await ethers.getContractFactory("SealTally");
  const sealTally = await SealTally.deploy(sealGovernorAddress);
  await sealTally.waitForDeployment();
  const sealTallyAddress = await sealTally.getAddress();
  console.log("SealTally deployed to:", sealTallyAddress);

  // 4. Link Tally to Governor
  console.log("Linking SealTally to SealGovernor...");
  const setTallyTx = await sealGovernor.setTally(sealTallyAddress);
  await setTallyTx.wait();
  console.log("SealTally linked to SealGovernor successfully.");

  // Save deployment addresses
  const deploymentData = {
    sealToken: sealTokenAddress,
    sealTally: sealTallyAddress,
    sealGovernor: sealGovernorAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));
  console.log("Deployment addresses saved to:", deploymentPath);

  // Output for frontend .env
  console.log("\n--- Frontend Environment Variables ---");
  console.log(`NEXT_PUBLIC_SEAL_TOKEN_ADDRESS=${sealTokenAddress}`);
  console.log(`NEXT_PUBLIC_SEAL_TALLY_ADDRESS=${sealTallyAddress}`);
  console.log(`NEXT_PUBLIC_SEAL_GOVERNOR_ADDRESS=${sealGovernorAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
