import { formatUnits } from 'ethers';
import type { TokenInfo } from '../types/cajo';

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats a bigint amount with the token's own decimals, entirely as strings so no
 * precision is lost. Truncates (never rounds up) to `maxFraction` digits.
 */
export function formatAmount(value: bigint, decimals: number, maxFraction = 4): string {
  const [whole, fraction = ''] = formatUnits(value, decimals).split('.');
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, '');
  if (value > 0n && whole === '0' && trimmed === '') return `<0.${'0'.repeat(maxFraction - 1)}1`;
  return trimmed ? `${groupThousands(whole)}.${trimmed}` : groupThousands(whole);
}

/** Amount plus symbol; falls back to raw base units when decimals are unknown. */
export function formatTokenAmount(value: bigint, token: TokenInfo): string {
  const symbol = token.symbol ?? 'tokens';
  if (token.decimals === null) return `${groupThousands(value.toString())} base units`;
  return `${formatAmount(value, token.decimals)} ${symbol}`;
}

export function formatBps(bps: number): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2).replace(/0$/, '')}%`;
}

/** uint64 seconds -> Date. Safe: chain timestamps are far below 2^53 ms. */
export function toDate(seconds: bigint): Date {
  return new Date(Number(seconds) * 1000);
}

const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

export function formatDuration(seconds: bigint): string {
  const total = Number(seconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const parts = [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : `${total}s`;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(Math.floor((total % 86_400) / 3_600))}h ${pad(Math.floor((total % 3_600) / 60))}m ${pad(total % 60)}s`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
