import { useCallback } from 'react';
import { ErrorState, Skeleton } from '../../components/Feedback';
import { WalletButton } from '../../components/WalletButton';
import { CHAIN, POLL_INTERVAL_MS } from '../../config';
import { usePolledResource } from '../../hooks/usePolledResource';
import { fetchMemberPosition } from '../../lib/cajo';
import { formatTokenAmount } from '../../lib/format';
import type { GroupRecord, TokenInfo } from '../../types/cajo';
import { useWallet } from '../../useWallet';

interface MyPositionProps {
  group: GroupRecord;
  token: TokenInfo;
}

export function MyPosition({ group, token }: MyPositionProps) {
  const wallet = useWallet();
  const account = wallet.status === 'connected' ? wallet.account : null;
  const fetcher = useCallback(
    (signal: AbortSignal) =>
      account ? fetchMemberPosition(group.id, account, signal) : Promise.reject(new Error('No wallet')),
    [group.id, account],
  );
  const position = usePolledResource(account ? `position:${group.id}:${account}` : null, fetcher, POLL_INTERVAL_MS);

  let body;
  if (wallet.status === 'unavailable') {
    body = (
      <>
        <p className="muted">Install a wallet like MetaMask to see your own slot, escrow and withdrawable balance.</p>
        <WalletButton />
      </>
    );
  } else if (!account) {
    body = (
      <>
        <p className="muted">Connect a wallet to see your slot in this group. Nothing is signed or sent.</p>
        <WalletButton />
      </>
    );
  } else if (position.isLoading) {
    body = (
      <>
        <p className="sr-only" role="status">
          Loading your position…
        </p>
        <Skeleton height="5em" />
      </>
    );
  } else if (!position.data) {
    body = <ErrorState title="Couldn't load your position" onRetry={position.refresh} />;
  } else if (position.data.state === 'None') {
    body = <p className="muted">This wallet hasn't joined group #{group.id.toString()}.</p>;
  } else {
    const p = position.data;
    body = (
      <dl className="facts-list">
        <div>
          <dt>Member state</dt>
          <dd>{p.state}</dd>
        </div>
        <div>
          <dt>Payout slot</dt>
          <dd>{p.payoutPosition}</dd>
        </div>
        <div>
          <dt>Rounds paid</dt>
          <dd>{p.roundsPaid}</dd>
        </div>
        <div>
          <dt>Escrow balance</dt>
          <dd>{formatTokenAmount(p.escrowBalance, token)}</dd>
        </div>
        <div>
          <dt>Payout received</dt>
          <dd>{p.payoutReceived ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Withdrawable</dt>
          <dd>{formatTokenAmount(p.withdrawable, token)}</dd>
        </div>
      </dl>
    );
  }

  return (
    <section className="detail-section my-position" aria-labelledby="position-title" aria-busy={position.isLoading}>
      <h3 id="position-title" className="detail-subtitle">
        My position
      </h3>
      {account && !wallet.isCorrectChain && (
        <p className="callout-inline callout-warn">
          Your wallet is on another network. This panel still reads {CHAIN.shortName} directly.
        </p>
      )}
      {body}
    </section>
  );
}
