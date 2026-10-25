import {
  BrowserProvider,
  Contract,
  Interface,
  isError,
  type ContractTransactionReceipt,
  type ContractTransactionResponse,
  type JsonRpcSigner,
} from 'ethers';
import { CAJO_ABI, ERC20_ABI } from '../abi';
import { CAJO_ADDRESS, CHAIN } from '../config';
import { fetchGasPrice } from './cajo';
import { describeWalletError, isUserRejection } from './walletErrors';

// The only transactions this app sends: an exact ERC-20 approval and joinGroup.

async function getSigner(): Promise<JsonRpcSigner> {
  const ethereum = window.ethereum;
  if (!ethereum) throw new Error('No wallet found.');
  const provider = new BrowserProvider(ethereum);
  const { chainId } = await provider.getNetwork();
  if (Number(chainId) !== CHAIN.id) throw new Error(`Switch your wallet to ${CHAIN.shortName} first.`);
  return provider.getSigner();
}

// MetaMask's own fee suggestion on BSC Testnet can be many times the network price,
// enough to show "insufficient funds" on a lightly funded test wallet. Passing the
// RPC's gas price makes MetaMask default to what the network actually charges.
async function gasOverrides(): Promise<{ gasPrice?: bigint }> {
  const gasPrice = await fetchGasPrice();
  return gasPrice ? { gasPrice } : {};
}

/** Approves exactly `amount`, never an unlimited allowance. Simulated first so a bad token fails before signing. */
export async function sendApprove(tokenAddress: string, amount: bigint): Promise<ContractTransactionResponse> {
  const token = new Contract(tokenAddress, ERC20_ABI, await getSigner());
  const approve = token.getFunction('approve');
  await approve.staticCall(CAJO_ADDRESS, amount);
  return approve.send(CAJO_ADDRESS, amount, await gasOverrides());
}

/** Simulates joinGroup first, so contract errors surface before MetaMask opens and cost no gas. */
export async function sendJoin(groupId: bigint, position: number): Promise<ContractTransactionResponse> {
  const cajo = new Contract(CAJO_ADDRESS, CAJO_ABI, await getSigner());
  const join = cajo.getFunction('joinGroup');
  await join.staticCall(groupId, position);
  return join.send(groupId, position, await gasOverrides());
}

export async function waitForSuccess(tx: ContractTransactionResponse): Promise<ContractTransactionReceipt> {
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error('The transaction was mined but reverted.');
  return receipt;
}

// Cajo's own errors plus OpenZeppelin token errors, for decoding revert data.
const errorInterface = new Interface([
  ...new Interface(CAJO_ABI).fragments.filter((f) => f.type === 'error'),
  ...new Interface(ERC20_ABI).fragments.filter((f) => f.type === 'error'),
]);

const REVERT_MESSAGES: Record<string, string> = {
  SlotTaken: 'Someone else took this slot first. Pick another open slot.',
  AlreadyJoined: 'This wallet already holds a slot in this group. Each wallet can join once.',
  FillDeadlinePassed: "This group's fill deadline has passed, so it can no longer be joined.",
  WrongState: 'This group is no longer open for joining.',
  InvalidSlot: "That slot number doesn't exist in this group.",
  ERC20InsufficientBalance: "Your token balance is lower than this slot's deposit.",
  ERC20InsufficientAllowance: 'The approval is lower than the deposit. Approve again, then join.',
  SafeERC20FailedOperation: "The group's token rejected the transfer. It may not be a standard ERC-20.",
};

function revertName(err: unknown): string | null {
  if (!isError(err, 'CALL_EXCEPTION')) return null;
  if (err.revert?.name) return err.revert.name;
  if (typeof err.data === 'string' && err.data.length >= 10) {
    try {
      return errorInterface.parseError(err.data)?.name ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Turns wallet, RPC and contract errors into one plain sentence for the user. */
export function describeTxError(err: unknown, rejectedText: string): string {
  if (isUserRejection(err)) return rejectedText;
  if (isError(err, 'INSUFFICIENT_FUNDS')) return 'Not enough tBNB for gas. Top up from the BNB Chain testnet faucet.';
  const name = revertName(err);
  if (name) return REVERT_MESSAGES[name] ?? `The contract rejected this (${name}).`;
  if (isError(err, 'CALL_EXCEPTION') && err.reason) return `The transaction would fail: ${err.reason}`;
  if (err instanceof Error && !('code' in err)) return err.message;
  return describeWalletError(err, rejectedText);
}
