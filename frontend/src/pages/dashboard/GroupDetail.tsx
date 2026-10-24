import { useCallback, useState } from 'react';
import { AddressDisplay } from '../../components/AddressDisplay';
import { ErrorState, Skeleton, StaleNotice } from '../../components/Feedback';
import { StatusBadge } from '../../components/StatusBadge';
import { POLL_INTERVAL_MS } from '../../config';
import { usePolledResource } from '../../hooks/usePolledResource';
import { fetchGroupDetail } from '../../lib/cajo';
import { formatBps, formatDuration, formatTokenAmount } from '../../lib/format';
import type { GroupRecord, TokenInfo } from '../../types/cajo';
import { useWallet } from '../../useWallet';
import { GroupTimeline } from './GroupTimeline';
import { JoinSlotDialog } from './JoinSlotDialog';
import { MyPosition } from './MyPosition';
import { SlotGrid } from './SlotGrid';

function parseGroupId(value: string): bigint | null {
  return /^\d{1,30}$/.test(value) ? BigInt(value) : null;
}

function RoundProgress({ group }: { group: GroupRecord }) {
  if (group.state !== 'Active') return null;
  const paid = group.contributionsThisRound;
  const total = group.memberCount;
  return (
    <div className="progress-block">
      <div className="progress-head">
        <span>Round {group.currentRound} contributions</span>
        <span className="mono">
          {paid} / {total}
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={`Round ${group.currentRound} contributions`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={paid}
        aria-valuetext={`${paid} of ${total} active members have paid`}
      >
        <span className="progress-fill" style={{ transform: `scaleX(${total > 0 ? paid / total : 0})` }} />
      </div>
    </div>
  );
}

function TokenLine({ token }: { token: TokenInfo }) {
  return (
    <span className="token-line">
      <span className="token-symbol">{token.symbol ?? 'Unknown token'}</span>
      {!token.allowlisted && (
        <span className="badge badge-warn" title="Any ERC-20 can back a group. Check this token before trusting it.">
          Unlisted token
        </span>
      )}
      <AddressDisplay address={token.address} label="token address" />
      {token.decimals === null && <span className="badge badge-warn">decimals() unreadable</span>}
    </span>
  );
}

export function GroupDetail({ idParam }: { idParam: string }) {
  const wallet = useWallet();
  const id = parseGroupId(idParam);
  const fetcher = useCallback(
    (signal: AbortSignal) => (id === null ? Promise.reject(new Error('Invalid id')) : fetchGroupDetail(id, signal)),
    [id],
  );
  const detail = usePolledResource(id === null ? null : `detail:${id}`, fetcher, POLL_INTERVAL_MS);
  const result = detail.data;
  const [joinPosition, setJoinPosition] = useState<number | null>(null);
  const closeJoin = useCallback(() => setJoinPosition(null), []);

  if (id === null || result?.kind === 'not-found') {
    const count = result?.kind === 'not-found' ? result.groupCount : null;
    return (
      <article className="detail" aria-labelledby="detail-title">
        <div className="state-block">
          <h2 id="detail-title" className="card-title">
            Group {id === null ? `"${idParam}"` : `#${idParam}`} doesn't exist
          </h2>
          <p className="muted">
            {count === null
              ? 'Group IDs are whole numbers starting at 1.'
              : count === 0n
                ? 'No groups have been created yet.'
                : `Valid IDs run from 1 to ${count.toString()}.`}
          </p>
        </div>
      </article>
    );
  }

  if (detail.isLoading) {
    return (
      <article className="detail" aria-busy="true" aria-labelledby="detail-title">
        <h2 id="detail-title" className="detail-title">
          Group #{idParam}
        </h2>
        <p className="sr-only" role="status">
          Loading group {idParam}…
        </p>
        <div className="detail-skeleton" aria-hidden="true">
          <Skeleton height="4.5em" />
          <Skeleton height="3em" />
          <Skeleton height="9em" />
        </div>
      </article>
    );
  }

  if (!result) {
    return (
      <article className="detail" aria-labelledby="detail-title">
        <h2 id="detail-title" className="detail-title">
          Group #{idParam}
        </h2>
        <ErrorState title="Couldn't load this group" onRetry={detail.refresh} />
      </article>
    );
  }

  const { group, token, slots, chainClockOffsetMs } = result;
  const amount = (value: bigint) => formatTokenAmount(value, token);

  return (
    <article className="detail" aria-labelledby="detail-title">
      <header className="detail-head">
        <h2 id="detail-title" className="detail-title">
          Group #{group.id.toString()}
        </h2>
        <StatusBadge state={group.state} />
      </header>

      {detail.error !== null && <StaleNotice lastUpdated={detail.lastUpdated} onRetry={detail.refresh} />}

      <dl className="facts-list">
        <div>
          <dt>Contribution per round</dt>
          <dd>{amount(group.contributionAmount)}</dd>
        </div>
        <div>
          <dt>Active members</dt>
          <dd>
            {group.memberCount} / {group.memberTarget}
          </dd>
        </div>
        <div>
          <dt>Current round</dt>
          <dd>{group.state === 'Active' ? `${group.currentRound} of ${group.memberTarget}` : '—'}</dd>
        </div>
        <div>
          <dt>Pot balance</dt>
          <dd>{amount(group.potBalance)}</dd>
        </div>
        <div>
          <dt>Round length</dt>
          <dd>{formatDuration(group.roundDuration)}</dd>
        </div>
        <div>
          <dt>Grace period</dt>
          <dd>{formatDuration(group.gracePeriod)}</dd>
        </div>
        <div>
          <dt>Group fee</dt>
          <dd>{formatBps(group.feeBps)} of each payout</dd>
        </div>
        {group.dripReserve > 0n && (
          <div>
            <dt>Seized deposits to drip</dt>
            <dd>{amount(group.dripReserve)}</dd>
          </div>
        )}
      </dl>

      <RoundProgress group={group} />

      <section className="detail-section" aria-labelledby="timeline-title">
        <h3 id="timeline-title" className="detail-subtitle">
          Timeline
        </h3>
        <GroupTimeline group={group} clockOffsetMs={chainClockOffsetMs} />
      </section>

      <section className="detail-section" aria-labelledby="slots-title">
        <h3 id="slots-title" className="detail-subtitle">
          Payout slots
        </h3>
        <SlotGrid
          group={group}
          token={token}
          slots={slots}
          account={wallet.account}
          onJoin={group.state === 'Open' ? setJoinPosition : undefined}
        />
      </section>

      <section className="detail-section" aria-labelledby="meta-title">
        <h3 id="meta-title" className="detail-subtitle">
          Token and creator
        </h3>
        <dl className="meta-list">
          <div>
            <dt>Token</dt>
            <dd>
              <TokenLine token={token} />
            </dd>
          </div>
          <div>
            <dt>Creator</dt>
            <dd>
              <AddressDisplay address={group.creator} label="creator address" />
            </dd>
          </div>
        </dl>
      </section>

      <MyPosition group={group} token={token} />

      {joinPosition !== null && (
        <JoinSlotDialog
          group={group}
          token={token}
          position={joinPosition}
          onClose={closeJoin}
          onJoined={detail.refresh}
        />
      )}
    </article>
  );
}
