import { ethers } from "hardhat";

/**
 * Mints the demo token (MockUSDT from scripts/demoSetup.ts) to more wallets, without creating a group.
 * Usage: DEMO_WALLETS=0xAccount3 npx hardhat run scripts/mintDemo.ts --network bscTestnet
 */
const DEMO_TOKEN = process.env.DEMO_TOKEN ?? "0x8eEAef54210EB230fFe0C17FBa9021DC9bd7E535";
const MINT_PER_WALLET = "1000";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 97n) throw new Error(`Refusing to run on chain ${chainId}; expected BSC Testnet (97).`);

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer. Set DEPLOYER_KEY in .env (the testnet wallet that pays gas).");

  const wallets = (process.env.DEMO_WALLETS ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => ethers.getAddress(w.toLowerCase()));
  if (wallets.length === 0) throw new Error("Set DEMO_WALLETS to the comma-separated addresses to fund.");

  const gasPrice = (await ethers.provider.getFeeData()).gasPrice ?? ethers.parseUnits("0.1", "gwei");
  const token = await ethers.getContractAt("MockUSDT", DEMO_TOKEN, signer);
  for (const wallet of wallets) {
    await (await token.mint(wallet, ethers.parseUnits(MINT_PER_WALLET, 18), { gasPrice })).wait();
    console.log(`Minted ${MINT_PER_WALLET} to ${wallet}; balance now ${ethers.formatUnits(await token.balanceOf(wallet), 18)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
