export const GROUP_STATES = ['Open', 'Active', 'Completed', 'Cancelled'] as const;
export type GroupState = (typeof GROUP_STATES)[number] | 'Unknown';

export const MEMBER_STATES = ['None', 'Active', 'Defaulted', 'Exited'] as const;
export type MemberState = (typeof MEMBER_STATES)[number] | 'Unknown';

// Token amounts and timestamps stay bigint. uint8/uint16 counters are converted
// to number explicitly because they always fit.
export interface GroupRecord {
  id: bigint;
  creator: string;
  token: string;
  contributionAmount: bigint;
  memberTarget: number;
  /** Active members: drops when someone defaults. */
  memberCount: number;
  currentRound: number;
  roundDuration: bigint;
  gracePeriod: bigint;
  roundStart: bigint;
  fillDeadline: bigint;
  state: GroupState;
  escrowMode: number;
  potBalance: bigint;
  dripReserve: bigint;
  feeBps: number;
  contributionsThisRound: number;
}

export interface TokenInfo {
  address: string;
  /** null when the token doesn't answer symbol() as a string. */
  symbol: string | null;
  /** null when decimals() fails; amounts are then shown in raw base units. */
  decimals: number | null;
  allowlisted: boolean;
}

export interface GroupSummary {
  group: GroupRecord;
  token: TokenInfo;
}

export interface Overview {
  groupCount: bigint;
  feeBps: number;
  rpcChainId: number;
  groups: GroupSummary[];
}

export interface SlotHolder {
  address: string;
  state: MemberState;
  roundsPaid: number;
  escrowBalance: bigint;
  payoutReceived: boolean;
}

export interface SlotInfo {
  /** 1-indexed payout position. */
  position: number;
  taken: boolean;
  holder: SlotHolder | null;
  /** slotDeposit(groupId, position); null if the read failed. */
  deposit: bigint | null;
}

export type GroupDetailResult =
  | {
      kind: 'found';
      group: GroupRecord;
      token: TokenInfo;
      slots: SlotInfo[];
      /** Latest block time minus this device's clock, in ms. Deadlines are judged by block time. */
      chainClockOffsetMs: number;
    }
  | { kind: 'not-found'; groupCount: bigint };

export interface MemberPosition {
  state: MemberState;
  payoutPosition: number;
  roundsPaid: number;
  escrowBalance: bigint;
  payoutReceived: boolean;
  withdrawable: bigint;
}

export interface LandingStats {
  groupCount: bigint | null;
  feeBps: number | null;
}

/** Everything needed to decide whether a wallet can join a slot, read fresh before signing. */
export interface JoinContext {
  memberState: MemberState;
  /** Current holder of the slot; the zero address when it is free. */
  slotHolder: string;
  deposit: bigint;
  balance: bigint;
  allowance: bigint;
  /** Latest block timestamp in seconds: the clock the fill deadline is judged by. */
  chainNow: bigint;
}
