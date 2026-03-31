import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * SealFi Deployment Script
 *
 * Deployment order (resolves circular dependency):
 *   1. SealToken
 *   2. SealGovernor (tally = address(0) initially)
 *   3. SealTally    (governor address known)
 *   4. SealGovernor.setTally(tallyAddress) — wire them together
 *
 * On Sepolia: waits for 2 confirmations per tx for reliability.
 * Saves addresses to deployment.json for frontend consumption.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const isSepolia = network.chainId === 11155111n;
  const confirms  = isSepolia ? 2 : 1;

  console.log(`\n🚀  Deploying SealFi on chain ${network.chainId}`);
  console.log(`    Deployer: ${deployer.address}`);
  console.log(`    Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ── 1. SealToken ──────────────────────────────────────────────────────────
  console.log("1/4  Deploying SealToken...");
  const SealTokenF = await ethers.getContractFactory("SealToken");
  const sealToken  = await SealTokenF.deploy();
  await sealToken.deploymentTransaction()?.wait(confirms);
  const tokenAddr  = await sealToken.getAddress();
  console.log(`     ✓ SealToken    @ ${tokenAddr}`);

  // ── 2. SealGovernor (tally = zero address placeholder) ────────────────────
  console.log("2/4  Deploying SealGovernor...");
  const SealGovernorF = await ethers.getContractFactory("SealGovernor");
  const sealGovernor  = await SealGovernorF.deploy(tokenAddr, ethers.ZeroAddress);
  await sealGovernor.deploymentTransaction()?.wait(confirms);
  const governorAddr  = await sealGovernor.getAddress();
  console.log(`     ✓ SealGovernor @ ${governorAddr}`);

  // ── 3. SealTally ──────────────────────────────────────────────────────────
  console.log("3/4  Deploying SealTally...");
  const SealTallyF = await ethers.getContractFactory("SealTally");
  const sealTally  = await SealTallyF.deploy(governorAddr);
  await sealTally.deploymentTransaction()?.wait(confirms);
  const tallyAddr  = await sealTally.getAddress();
  console.log(`     ✓ SealTally    @ ${tallyAddr}`);

  // ── 4. Wire tally into governor ───────────────────────────────────────────
  console.log("4/4  Wiring SealTally into SealGovernor...");
  const wireTx = await sealGovernor.setTally(tallyAddr);
  await wireTx.wait(confirms);
  console.log("     ✓ setTally() confirmed\n");

  // ── Mint initial supply to deployer for testing ───────────────────────────
  const initialMint = ethers.parseEther("10000000"); // 10M SEAL
  const mintTx = await sealToken.mint(deployer.address, initialMint);
  await mintTx.wait(confirms);
  console.log(`     ✓ Minted ${ethers.formatEther(initialMint)} SEAL to deployer\n`);

  // ── Save deployment JSON ──────────────────────────────────────────────────
  const deployment = {
    network:     network.name,
    chainId:     network.chainId.toString(),
    deployer:    deployer.address,
    timestamp:   new Date().toISOString(),
    contracts: {
      SealToken:    tokenAddr,
      SealGovernor: governorAddr,
      SealTally:    tallyAddr,
    },
  };

  const outPath = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`📄  Saved deployment addresses to deployment.json`);

  // ── Update frontend .env ───────────────────────────────────────────────────
  const frontendEnv = path.join(__dirname, "..", "..", "frontend", ".env");
  if (fs.existsSync(frontendEnv)) {
    let content = fs.readFileSync(frontendEnv, "utf-8");
    content = upsert(content, "VITE_TOKEN_ADDRESS",    tokenAddr);
    content = upsert(content, "VITE_GOVERNOR_ADDRESS", governorAddr);
    content = upsert(content, "VITE_TALLY_ADDRESS",    tallyAddr);
    fs.writeFileSync(frontendEnv, content);
    console.log(`🔗  Updated frontend/.env with contract addresses`);
  }

  console.log("\n✅  Deployment complete!\n");
  console.log("   SealToken:   ", tokenAddr);
  console.log("   SealGovernor:", governorAddr);
  console.log("   SealTally:   ", tallyAddr);
  console.log("");
}

/** Upsert KEY=VALUE in an .env file string. */
function upsert(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, "m");
  const line  = `${key}=${value}`;
  return regex.test(content) ? content.replace(regex, line) : content + `\n${line}`;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
