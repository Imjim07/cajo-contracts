import { ethers, network } from "hardhat";

/**
 * Creates a demo group on the deployed CÀjọ contract so the dashboard has live data.
 * Usage: npx hardhat run scripts/createGroup.ts --network bscTestnet
 *
 * The creator takes the LAST slot, whose deposit is contribution x (members - members) = 0,
 * so no token approval or token balance is needed; only tBNB for gas.
 */
const CAJO = "0xc9d30A50579Fbd7aEDb48a4E7F02Eab56C3298b4";
const TOKEN = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"; // BNB Chain testnet faucet USDT (18 decimals)
const CONTRIBUTION = "10"; // per member per round, in whole tokens
const MEMBERS = 3; // 2..50
const ROUND_DURATION = 24 * 60 * 60; // >= 1 day
const GRACE_PERIOD = 6 * 60 * 60; // >= 6 hours
const FILL_WINDOW = 7 * 24 * 60 * 60; // 1 hour .. 365 days
const PUBLIC_MODE = 0; // EscrowMode.Public, the only mode v1 accepts

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 97n) throw new Error(`Refusing to run on chain ${chainId}; expected BSC Testnet (97).`);

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer. Set DEPLOYER_KEY in .env (a throwaway testnet wallet).");
  console.log("Creator:", signer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "tBNB");

  const cajo = await ethers.getContractAt("Cajo", CAJO, signer);
  const token = await ethers.getContractAt(
    ["function decimals() view returns (uint8)", "function symbol() view returns (string)"],
    TOKEN,
  );
  const decimals: bigint = await token.decimals();
  const contribution = ethers.parseUnits(CONTRIBUTION, decimals);
  const args = [TOKEN, contribution, MEMBERS, ROUND_DURATION, GRACE_PERIOD, FILL_WINDOW, PUBLIC_MODE, MEMBERS] as const;

  // Simulate first: surfaces a revert reason without spending gas, and returns the new id.
  const expectedId = await cajo.createGroup.staticCall(...args);
  console.log(`Creating group #${expectedId}: ${CONTRIBUTION} ${await token.symbol()} x ${MEMBERS} members on ${network.name}...`);

  const tx = await cajo.createGroup(...args);
  console.log("Tx:", `https://testnet.bscscan.com/tx/${tx.hash}`);
  await tx.wait();

  console.log("groupCount is now", (await cajo.groupCount()).toString());
  console.log(`Dashboard: /app?group=${expectedId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
