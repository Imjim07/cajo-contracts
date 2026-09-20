import { ethers } from "hardhat";

/**
 * Deploys CÀjọ to whatever network Hardhat is pointed at.
 * Usage: npx hardhat run scripts/deploy.ts --network bscTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "tBNB");

  const treasury = deployer.address; // testnet: you collect your own test fees
  const feeBps = 100; // 1%

  const Cajo = await ethers.getContractFactory("Cajo");
  console.log("Deploying Cajo...");
  const cajo = await Cajo.deploy(treasury, feeBps);
  await cajo.waitForDeployment();

  const address = await cajo.getAddress();
  console.log("\n==============================================");
  console.log("  CÀjọ deployed to:", address);
  console.log("  Treasury:", treasury);
  console.log("  Fee:", feeBps / 100, "%");
  console.log("==============================================");
  console.log("\nView it on BscScan Testnet:");
  console.log("  https://testnet.bscscan.com/address/" + address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});