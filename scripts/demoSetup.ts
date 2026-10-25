import { ethers } from "hardhat";

/**
 * One-shot demo setup, so the recording doesn't depend on faucets:
 *   1. deploys MockUSDT (test-only token; anyone can mint it),
 *   2. mints test tokens to the demo wallets,
 *   3. creates a demo group that uses it, creator in the last (zero-deposit) slot.
 *
 * Usage: DEMO_WALLETS=0xAccount2,0xAccount3 npx hardhat run scripts/demoSetup.ts --network bscTestnet
 * Every transaction pays the network's current gas price (about 0.1 gwei on BSC Testnet).
 */
const CAJO = process.env.CAJO_ADDRESS ?? "0xc9d30A50579Fbd7aEDb48a4E7F02Eab56C3298b4";
const MINT_PER_WALLET = "1000"; // test tokens per demo wallet
const CONTRIBUTION = "1"; // per member per round: slot 1 locks 2, slot 2 locks 1
const MEMBERS = 3;
const ROUND_DURATION = 24 * 60 * 60;
const GRACE_PERIOD = 6 * 60 * 60;
const FILL_WINDOW = 7 * 24 * 60 * 60;

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
  if (wallets.length === 0) throw new Error("Set DEMO_WALLETS to the comma-separated addresses that will join.");

  const gasPrice = (await ethers.provider.getFeeData()).gasPrice ?? ethers.parseUnits("0.1", "gwei");
  const overrides = { gasPrice };
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Payer ${signer.address}: ${ethers.formatEther(balance)} tBNB, gas price ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

  const token = await (await ethers.getContractFactory("MockUSDT", signer)).deploy(overrides);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("MockUSDT deployed:", tokenAddress);

  const amount = ethers.parseUnits(MINT_PER_WALLET, 18);
  for (const wallet of wallets) {
    await (await token.mint(wallet, amount, overrides)).wait();
    console.log(`Minted ${MINT_PER_WALLET} to ${wallet}`);
  }

  const cajo = await ethers.getContractAt("Cajo", CAJO, signer);
  const args = [tokenAddress, ethers.parseUnits(CONTRIBUTION, 18), MEMBERS, ROUND_DURATION, GRACE_PERIOD, FILL_WINDOW, 0, MEMBERS] as const;
  const groupId = await cajo.createGroup.staticCall(...args);
  await (await cajo.createGroup(...args, overrides)).wait();
  console.log(`Created group #${groupId}: ${CONTRIBUTION} token x ${MEMBERS} members, creator in slot ${MEMBERS}`);

  const spent = balance - (await ethers.provider.getBalance(signer.address));
  console.log(`Total gas spent: ${ethers.formatEther(spent)} tBNB`);
  console.log(`\nToken for the allowlist: ${tokenAddress}\nDashboard: /app?group=${groupId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
