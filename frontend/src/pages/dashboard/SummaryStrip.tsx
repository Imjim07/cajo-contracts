import { Skeleton } from '../../components/Feedback';
import { RefreshIcon } from '../../components/Icons';
import { WalletButton } from '../../components/WalletButton';
import { CHAIN, MAX_FEE_BPS } from '../../config';
import type { Resource } from '../../hooks/usePolledResource';
import { formatBps, formatTime } from '../../lib/format';
import type { Overview } from '../../types/cajo';
import { useWallet } from '../../useWallet';

function RpcStatus({ overview }: { overview: Resource<Overview> }) {
  if (overview.isLoading) return <Skeleton width="7em" />;
  if (!overview.data) return <span className="status-text status-danger">RPC unreachable</span>;
  if (overview.data.rpcChainId !== CHAIN.id) {
    return <span className="status-text status-warn">RPC is on chain {overview.data.rpcChainId}</span>;
  }
  return <span className="status-text status-ok">{CHAIN.shortName}</span>;
}

function WalletStatusLine() {
  const wallet = useWallet();
  if (wallet.status === 'connected' && !wallet.isCorrectChain) {
    return (
      <span className="tile-sub tile-sub-action">
        <span className="status-text status-warn">Wallet on another network</span>
        <WalletButton className="btn-sm" />
      </span>
    );
  }
  const text =
    wallet.status === 'unavailable'
      ? 'No wallet found. Reading works without one.'
      : wallet.status === 'connected'
        ? `Wallet on ${CHAIN.shortName}`
        : 'Wallet not connected. Reading works without one.';
  return <span className="tile-sub">{text}</span>;
}

export function SummaryStrip({ overview }: { overview: Resource<Overview> }) {
  const { data, isLoading, isRefreshing, lastUpdated, refresh } = overview;

  return (
    <section className="summary" aria-label="Summary">
      <div className="tile">
        <span className="tile-label">Groups created</span>
        <span className="tile-value">{isLoading ? <Skeleton width="2.5em" /> : (data?.groupCount.toString() ?? '—')}</span>
      </div>
      <div className="tile">
        <span className="tile-label">Current fee</span>
        <span className="tile-value">{isLoading ? <Skeleton width="3em" /> : data ? formatBps(data.feeBps) : '—'}</span>
        <span className="tile-sub">Of each payout. Capped at {formatBps(MAX_FEE_BPS)} in code.</span>
      </div>
      <div className="tile">
        <span className="tile-label">Network</span>
        <span className="tile-value tile-value-sm">
          <RpcStatus overview={overview} />
        </span>
        <WalletStatusLine />
      </div>
      <div className="tile">
        <span className="tile-label">Last updated</span>
        <span className="tile-value tile-value-sm">
          {lastUpdated ? formatTime(lastUpdated) : isLoading ? <Skeleton width="5em" /> : '—'}
        </span>
        <span className="tile-sub tile-sub-action">
          <span aria-live="polite">{isRefreshing ? 'Refreshing…' : 'Refreshes every 15 s'}</span>
          <button
            type="button"
            className={`icon-btn${isRefreshing ? ' is-spinning' : ''}`}
            onClick={refresh}
            aria-label="Refresh now"
          >
            <RefreshIcon />
          </button>
        </span>
      </div>
    </section>
  );
}
