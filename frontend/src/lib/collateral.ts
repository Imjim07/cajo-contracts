import { parseUnits } from 'ethers';

// Client-side illustration of slotDeposit: deposit = contribution x (members - position).
// Amounts are parsed into fixed-point bigints so the maths never touches floats.

export const ILLUSTRATION_DECIMALS = 2;
export const MIN_MEMBERS = 2;
export const MAX_MEMBERS = 50;
const MAX_CONTRIBUTION = parseUnits('1000000000', ILLUSTRATION_DECIMALS);

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseContribution(input: string): ParseResult<bigint> {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'Enter a contribution amount.' };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { ok: false, error: 'Use a positive number with up to 2 decimal places.' };
  }
  const value = parseUnits(text, ILLUSTRATION_DECIMALS);
  if (value <= 0n) return { ok: false, error: 'The contribution must be more than 0.' };
  if (value > MAX_CONTRIBUTION) return { ok: false, error: 'Keep the amount under 1,000,000,000.' };
  return { ok: true, value };
}

export function parseMembers(input: string): ParseResult<number> {
  const text = input.trim();
  if (!/^\d+$/.test(text)) return { ok: false, error: `Enter a whole number from ${MIN_MEMBERS} to ${MAX_MEMBERS}.` };
  const value = Number(text);
  if (value < MIN_MEMBERS || value > MAX_MEMBERS) {
    return { ok: false, error: `Groups have ${MIN_MEMBERS} to ${MAX_MEMBERS} members.` };
  }
  return { ok: true, value };
}

export interface IllustratedSlot {
  position: number;
  deposit: bigint;
  /** 0..1 relative to position 1, for the bar width. */
  share: number;
}

export function illustrateDeposits(contribution: bigint, members: number): IllustratedSlot[] {
  return Array.from({ length: members }, (_, i) => {
    const position = i + 1;
    const roundsOwedAfter = members - position;
    return {
      position,
      deposit: contribution * BigInt(roundsOwedAfter),
      share: roundsOwedAfter / (members - 1),
    };
  });
}
