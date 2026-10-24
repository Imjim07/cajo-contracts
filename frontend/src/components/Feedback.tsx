import type { ReactNode } from 'react';
import { formatTime } from '../lib/format';
import { RefreshIcon, WarningIcon } from './Icons';

export function Skeleton({ width = '100%', height = '1em' }: { width?: string; height?: string }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

interface ErrorStateProps {
  title: string;
  onRetry: () => void;
  children?: ReactNode;
}

/** Full error block for when there is no data to show at all. */
export function ErrorState({ title, onRetry, children }: ErrorStateProps) {
  return (
    <div className="state-block state-error" role="alert">
      <WarningIcon size={22} />
      <h3 className="card-title">{title}</h3>
      <p className="muted">
        {children ?? 'The BSC Testnet RPC did not respond. Public endpoints are sometimes busy; try again in a moment.'}
      </p>
      <button type="button" className="btn btn-secondary" onClick={onRetry}>
        <RefreshIcon /> Retry
      </button>
    </div>
  );
}

/** Inline notice for when a refresh fails but older data is still on screen. */
export function StaleNotice({ lastUpdated, onRetry }: { lastUpdated: Date | null; onRetry: () => void }) {
  return (
    <div className="stale-notice" role="status">
      <WarningIcon size={16} />
      <span>
        Couldn't refresh.{lastUpdated ? ` Showing data from ${formatTime(lastUpdated)}.` : ''}
      </span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
