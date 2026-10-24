import { Interface, JsonRpcProvider, Network, ZeroAddress, getAddress, type Result } from 'ethers';
import { CAJO_ABI, ERC20_ABI } from '../abi';
import { CAJO_ADDRESS, CHAIN, MAX_CONCURRENT_RPC, RECENT_GROUP_LIMIT, RPC_URL, isAllowlistedToken } from '../config';
import {
  GROUP_STATES,
  MEMBER_STATES,
  type GroupDetailResult,
  type GroupRecord,
  type GroupState,
  type GroupSummary,
  type LandingStats,
  type MemberPosition,
  type MemberState,
  type Overview,
  type SlotInfo,
  type TokenInfo,
} from '../types/cajo';
import { AbortedError, createLimiter } from './limiter';

// Reads go straight to a BSC Testnet RPC, so the dashboard works with no wallet.
const network = Network.from(CHAIN.id);
const provider = new JsonRpcProvider(RPC_URL, network, { staticNetwork: network, batchMaxCount: 1 });
const cajo = new Interface(CAJO_ABI);
const erc20 = new Interface(ERC20_ABI);
const limit = createLimiter(MAX_CONCURRENT_RPC);

async function read(
  target: string,
  iface: Interface,
  fn: string,
  args: readonly unknown[],
  signal?: AbortSignal,
): Promise<Result> {
  const data = iface.encodeFunctionData(fn, args);
  const raw = await limit(() => provider.call({ to: target, data }), signal);
  if (signal?.aborted) throw new AbortedError();
  return iface.decodeFunctionResult(fn, raw);
}

const readCajo = (fn: string, args: readonly unknown[], signal?: AbortSignal) =>
  read(CAJO_ADDRESS, cajo, fn, args, signal);

// Typed accessors: decoded values arrive untyped, so check each one.
function big(result: Result, index: number): bigint {
  const value: unknown = result[index];
  if (typeof value !== 'bigint') throw new TypeError(`Expected bigint at output ${index}`);
  return value;
}

/** For uint8/uint16 outputs only, which always fit in a number. */
function small(result: Result, index: number): number {
  return Number(big(result, index));
}

function address(result: Result, index: number): string {
  const value: unknown = result[index];
  if (typeof value !== 'string') throw new TypeError(`Expected address at output ${index}`);
  return getAddress(value);
}

function bool(result: Result, index: number): boolean {
  const value: unknown = result[index];
  if (typeof value !== 'boolean') throw new TypeError(`Expected bool at output ${index}`);
  return value;
}

function groupState(value: number): GroupState {
  return GROUP_STATES[value] ?? 'Unknown';
}

function memberState(value: number): MemberState {
  return MEMBER_STATES[value] ?? 'Unknown';
}

export async function fetchGroupCount(signal?: AbortSignal): Promise<bigint> {
  return big(await readCajo('groupCount', [], signal), 0);
}

export async function fetchFeeBps(signal?: AbortSignal): Promise<number> {
  return small(await readCajo('feeBps', [], signal), 0);
}

async function fetchRpcChainId(signal?: AbortSignal): Promise<number> {
  const hex: unknown = await limit(() => provider.send('eth_chainId', []), signal);
  if (typeof hex !== 'string') throw new TypeError('Unexpected eth_chainId response');
  return Number.parseInt(hex, 16);
}

async function fetchChainClockOffsetMs(signal?: AbortSignal): Promise<number> {
  const block = await limit(() => provider.getBlock('latest'), signal);
  return block ? block.timestamp * 1000 - Date.now() : 0;
}

/**
 * Returns null for a group that doesn't exist. groups() never reverts: an unknown id
 * comes back as all zeros, and state 0 would otherwise read as "Open".
 */
export async function fetchGroup(id: bigint, signal?: AbortSignal): Promise<GroupRecord | null> {
  const r = await readCajo('groups', [id], signal);
  const creator = address(r, 0);
  if (creator === ZeroAddress) return null;
  return {
    id,
    creator,
    token: address(r, 1),
    contributionAmount: big(r, 2),
    memberTarget: small(r, 3),
    memberCount: small(r, 4),
    currentRound: small(r, 5),
    roundDuration: big(r, 6),
    gracePeriod: big(r, 7),
    roundStart: big(r, 8),
    fillDeadline: big(r, 9),
    state: groupState(small(r, 10)),
    escrowMode: small(r, 11),
    potBalance: big(r, 12),
    dripReserve: big(r, 13),
    feeBps: small(r, 14),
    contributionsThisRound: small(r, 15),
  };
}

// symbol and decimals don't change, so each token is read once per session.
const tokenCache = new Map<string, Promise<TokenInfo>>();

async function loadToken(tokenAddress: string): Promise<TokenInfo> {
  const [symbol, decimals] = await Promise.allSettled([
    read(tokenAddress, erc20, 'symbol', []),
    read(tokenAddress, erc20, 'decimals', []),
  ]);
  const rawSymbol: unknown = symbol.status === 'fulfilled' ? symbol.value[0] : null;
  return {
    address: tokenAddress,
    symbol: typeof rawSymbol === 'string' && rawSymbol.trim() ? rawSymbol.trim().slice(0, 16) : null,
    decimals: decimals.status === 'fulfilled' ? small(decimals.value, 0) : null,
    allowlisted: isAllowlistedToken(tokenAddress),
  };
}

export function fetchToken(tokenAddress: string): Promise<TokenInfo> {
  const key = tokenAddress.toLowerCase();
  let pending = tokenCache.get(key);
  if (!pending) {
    pending = loadToken(tokenAddress);
    tokenCache.set(key, pending);
    // Don't cache a total failure; retry next time.
    pending.then(
      (info) => {
        if (info.symbol === null && info.decimals === null) tokenCache.delete(key);
      },
      () => tokenCache.delete(key),
    );
  }
  return pending;
}

/** Newest first: groupCount, groupCount - 1, ... down to 1. */
export function recentGroupIds(groupCount: bigint, max = RECENT_GROUP_LIMIT): bigint[] {
  const ids: bigint[] = [];
  for (let id = groupCount; id >= 1n && ids.length < max; id--) ids.push(id);
  return ids;
}

export async function fetchOverview(signal: AbortSignal): Promise<Overview> {
  const [groupCount, feeBps, rpcChainId] = await Promise.all([
    fetchGroupCount(signal),
    fetchFeeBps(signal),
    fetchRpcChainId(signal),
  ]);
  const records = await Promise.all(recentGroupIds(groupCount).map((id) => fetchGroup(id, signal)));
  const groups = await Promise.all(
    records
      .filter((group): group is GroupRecord => group !== null)
      .map(async (group): Promise<GroupSummary> => ({ group, token: await fetchToken(group.token) })),
  );
  return { groupCount, feeBps, rpcChainId, groups };
}

export async function fetchLandingStats(signal: AbortSignal): Promise<LandingStats> {
  const [count, fee] = await Promise.allSettled([fetchGroupCount(signal), fetchFeeBps(signal)]);
  return {
    groupCount: count.status === 'fulfilled' ? count.value : null,
    feeBps: fee.status === 'fulfilled' ? fee.value : null,
  };
}

async function fetchMemberRecord(groupId: bigint, account: string, signal?: AbortSignal) {
  const r = await readCajo('members', [groupId, account], signal);
  return {
    state: memberState(small(r, 0)),
    payoutPosition: small(r, 1),
    roundsPaid: small(r, 2),
    escrowBalance: big(r, 3),
    payoutReceived: bool(r, 4),
  };
}

async function fetchSlots(group: GroupRecord, signal: AbortSignal): Promise<SlotInfo[]> {
  const takenResult = await readCajo('openSlots', [group.id], signal);
  const takenRaw: unknown = takenResult[0];
  const taken = Array.isArray(takenRaw) ? takenRaw.map((value) => value === true) : [];
  const positions = Array.from({ length: group.memberTarget }, (_, i) => i + 1);

  return Promise.all(
    positions.map(async (position): Promise<SlotInfo> => {
      // openSlots is 0-indexed; positions are 1-indexed.
      const isTaken = taken[position - 1] ?? false;
      const depositRead = readCajo('slotDeposit', [group.id, position], signal)
        .then((r) => big(r, 0))
        .catch(() => null);
      let holder: SlotInfo['holder'] = null;
      if (isTaken) {
        const holderAddress = address(await readCajo('payoutOrder', [group.id, position], signal), 0);
        if (holderAddress !== ZeroAddress) {
          holder = { address: holderAddress, ...(await fetchMemberRecord(group.id, holderAddress, signal)) };
        }
      }
      return { position, taken: isTaken, holder, deposit: await depositRead };
    }),
  );
}

// Slot data only changes when someone joins, pays, defaults or a round advances,
// so re-read it only when one of those fields moves.
const slotCache = new Map<string, SlotInfo[]>();

function slotCacheKey(group: GroupRecord): string {
  return [
    group.id,
    group.state,
    group.memberTarget,
    group.memberCount,
    group.currentRound,
    group.contributionsThisRound,
  ].join(':');
}

export async function fetchGroupDetail(id: bigint, signal: AbortSignal): Promise<GroupDetailResult> {
  const groupCount = await fetchGroupCount(signal);
  if (id < 1n || id > groupCount) return { kind: 'not-found', groupCount };
  const group = await fetchGroup(id, signal);
  if (!group) return { kind: 'not-found', groupCount };

  const key = slotCacheKey(group);
  let slots = slotCache.get(key);
  if (!slots) {
    slots = await fetchSlots(group, signal);
    if (signal.aborted) throw new AbortedError();
    // Only cache complete reads, otherwise a failed slotDeposit would stick.
    if (slots.every((slot) => slot.deposit !== null)) {
      if (slotCache.size > 50) slotCache.clear();
      slotCache.set(key, slots);
    }
  }
  const [token, chainClockOffsetMs] = await Promise.all([fetchToken(group.token), fetchChainClockOffsetMs(signal)]);
  return { kind: 'found', group, token, slots, chainClockOffsetMs };
}

export async function fetchMemberPosition(
  groupId: bigint,
  account: string,
  signal: AbortSignal,
): Promise<MemberPosition> {
  const [record, withdrawableResult] = await Promise.all([
    fetchMemberRecord(groupId, account, signal),
    readCajo('withdrawable', [groupId, account], signal),
  ]);
  return { ...record, withdrawable: big(withdrawableResult, 0) };
}
