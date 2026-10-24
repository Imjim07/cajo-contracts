import { useNow } from '../../hooks/useNow';
import { formatCountdown, formatDateTime, formatDuration, toDate } from '../../lib/format';
import type { GroupRecord } from '../../types/cajo';

function Countdown({ label, target, now }: { label: string; target: Date; now: number }) {
  return (
    <p className="countdown">
      <span>{label}</span>{' '}
      {/* Re-keyed each second so the tick animation replays. */}
      <span key={Math.floor(now / 1000)} className="countdown-value mono">
        {formatCountdown(target.getTime() - now)}
      </span>
    </p>
  );
}

interface GroupTimelineProps {
  group: GroupRecord;
  /** Block time minus device time; keeps countdowns on chain time even if this clock is off. */
  clockOffsetMs: number;
}

export function GroupTimeline({ group, clockOffsetMs }: GroupTimelineProps) {
  const ticking = group.state === 'Active' || group.state === 'Open';
  const now = useNow(ticking) + clockOffsetMs;

  if (group.state === 'Open') {
    const fillBy = toDate(group.fillDeadline);
    const passed = now > fillBy.getTime();
    return (
      <div className="timeline-block">
        <ol className="timeline">
          <li>
            <span className="timeline-label">Fill deadline</span>
            <time dateTime={fillBy.toISOString()}>{formatDateTime(fillBy)}</time>
          </li>
        </ol>
        {passed ? (
          <p className="callout-inline callout-warn">
            The fill deadline has passed. Anyone can now cancel this group so members can reclaim deposits.
          </p>
        ) : (
          <Countdown label="Fills or becomes cancellable in" target={fillBy} now={now} />
        )}
        <p className="muted small">Round deadlines start once every slot is taken.</p>
      </div>
    );
  }

  if (group.state !== 'Active') {
    return (
      <p className="muted">
        {group.state === 'Completed'
          ? 'Every round has paid out. Members in good standing can reclaim their deposits.'
          : group.state === 'Cancelled'
            ? 'This group was cancelled before it filled. Members can reclaim their deposits.'
            : 'This group is in an unrecognised state.'}
      </p>
    );
  }

  // roundDeadline from the contract excludes grace, so the default cutoff is computed here.
  const deadlineSeconds = group.roundStart + group.roundDuration;
  const started = toDate(group.roundStart);
  const deadline = toDate(deadlineSeconds);
  const cutoff = toDate(deadlineSeconds + group.gracePeriod);
  const phase = now < deadline.getTime() ? 'open' : now < cutoff.getTime() ? 'grace' : 'past';

  return (
    <div className="timeline-block">
      <ol className="timeline">
        <li className="is-done">
          <span className="timeline-label">Round {group.currentRound} started</span>
          <time dateTime={started.toISOString()}>{formatDateTime(started)}</time>
        </li>
        <li className={phase === 'open' ? 'is-current' : 'is-done'}>
          <span className="timeline-label">Round deadline</span>
          <time dateTime={deadline.toISOString()}>{formatDateTime(deadline)}</time>
        </li>
        <li className={phase === 'grace' ? 'is-current' : phase === 'past' ? 'is-done' : ''}>
          <span className="timeline-label">Default cutoff (deadline + {formatDuration(group.gracePeriod)} grace)</span>
          <time dateTime={cutoff.toISOString()}>{formatDateTime(cutoff)}</time>
        </li>
      </ol>
      {phase === 'open' && <Countdown label="Round deadline in" target={deadline} now={now} />}
      {phase === 'grace' && <Countdown label="Grace period ends in" target={cutoff} now={now} />}
      {phase === 'past' && (
        <p className="callout-inline callout-warn">
          Past the default cutoff. Anyone can now remove members who haven't paid, or trigger the payout.
        </p>
      )}
      <p className="muted small">Countdowns follow the latest block time, which is what the contract checks.</p>
    </div>
  );
}
