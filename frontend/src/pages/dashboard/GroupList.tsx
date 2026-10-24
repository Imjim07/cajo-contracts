import { useId, useState, type FormEvent } from 'react';
import { ErrorState, Skeleton, StaleNotice } from '../../components/Feedback';
import { StatusBadge } from '../../components/StatusBadge';
import { CONTRACT_EXPLORER_URL, RECENT_GROUP_LIMIT } from '../../config';
import type { Resource } from '../../hooks/usePolledResource';
import { formatTokenAmount } from '../../lib/format';
import { GROUP_STATES, type GroupState, type GroupSummary, type Overview } from '../../types/cajo';

type Filter = GroupState | 'All';
const FILTERS: readonly Filter[] = ['All', ...GROUP_STATES];

interface GroupListProps {
  overview: Resource<Overview>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function GroupCard({ summary, selected, onSelect }: { summary: GroupSummary; selected: boolean; onSelect: () => void }) {
  const { group, token } = summary;
  const isActive = group.state === 'Active';
  return (
    <button type="button" className="group-card" aria-current={selected ? 'true' : undefined} onClick={onSelect}>
      <span className="group-card-top">
        <span className="group-card-id">Group #{group.id.toString()}</span>
        <StatusBadge state={group.state} />
      </span>
      <span className="group-card-token">
        {token.symbol ?? 'Unknown token'}
        {!token.allowlisted && <span className="badge badge-warn">Unlisted token</span>}
      </span>
      <span className="group-card-stats">
        <span>
          <span className="stat-label">Contribution</span>
          <span className="stat-text">{formatTokenAmount(group.contributionAmount, token)}</span>
        </span>
        <span>
          <span className="stat-label">Active members</span>
          <span className="stat-text">
            {group.memberCount} / {group.memberTarget}
          </span>
        </span>
        <span>
          <span className="stat-label">Round</span>
          <span className="stat-text">{isActive ? `${group.currentRound} of ${group.memberTarget}` : '—'}</span>
        </span>
        <span>
          <span className="stat-label">Pot</span>
          <span className="stat-text">{formatTokenAmount(group.potBalance, token)}</span>
        </span>
      </span>
    </button>
  );
}

function GroupLookup({ onSelect }: { onSelect: (id: string) => void }) {
  const inputId = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (!/^\d{1,30}$/.test(text) || BigInt(text) < 1n) {
      setError('Enter a group ID: a whole number from 1.');
      return;
    }
    setError(null);
    onSelect(BigInt(text).toString());
  };

  return (
    <form className="lookup" onSubmit={submit} noValidate>
      <label htmlFor={inputId} className="lookup-label">
        Go to group ID
      </label>
      <div className="lookup-row">
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          placeholder="e.g. 1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <button type="submit" className="btn btn-secondary">
          Go
        </button>
      </div>
      {error && (
        <p id={`${inputId}-error`} className="field-error">
          {error}
        </p>
      )}
    </form>
  );
}

export function GroupList({ overview, selectedId, onSelect }: GroupListProps) {
  const [filter, setFilter] = useState<Filter>('All');
  const { data, error, isLoading, lastUpdated, refresh } = overview;
  const groups = data?.groups ?? [];
  const visible = filter === 'All' ? groups : groups.filter((g) => g.group.state === filter);
  const countFor = (f: Filter) => (f === 'All' ? groups.length : groups.filter((g) => g.group.state === f).length);

  let body;
  if (isLoading) {
    body = (
      <ul className="group-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="group-card group-card-skeleton">
            <Skeleton width="45%" height="1.1em" />
            <Skeleton width="30%" />
            <Skeleton height="2.6em" />
          </li>
        ))}
      </ul>
    );
  } else if (!data) {
    body = <ErrorState title="Couldn't load groups" onRetry={refresh} />;
  } else if (data.groupCount === 0n) {
    body = (
      <div className="state-block">
        <h3 className="card-title">No groups yet</h3>
        <p className="muted">
          The contract is live but nobody has created a group. Groups appear here as soon as someone calls{' '}
          <code>createGroup</code>.{' '}
          <a href={CONTRACT_EXPLORER_URL} target="_blank" rel="noopener noreferrer">
            View the contract on BscScan
          </a>
          .
        </p>
      </div>
    );
  } else if (visible.length === 0) {
    body = (
      <div className="state-block">
        <p className="muted">
          No {filter.toLowerCase()} groups among the latest {groups.length}.
        </p>
        <button type="button" className="btn btn-secondary" onClick={() => setFilter('All')}>
          Show all groups
        </button>
      </div>
    );
  } else {
    body = (
      <ul className="group-grid">
        {visible.map((summary) => {
          const id = summary.group.id.toString();
          return (
            <li key={id}>
              <GroupCard summary={summary} selected={id === selectedId} onSelect={() => onSelect(id)} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="dash-list" aria-labelledby="groups-title" aria-busy={isLoading}>
      <div className="dash-list-head">
        <h2 id="groups-title" className="card-title">
          Latest groups
        </h2>
        <p className="muted small">Up to {RECENT_GROUP_LIMIT}, newest first.</p>
      </div>

      <GroupLookup onSelect={onSelect} />

      <div className="chips" role="group" aria-label="Filter groups by status">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            disabled={!data}
          >
            {f}
            {data && <span className="chip-count">{countFor(f)}</span>}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status">
        {isLoading ? 'Loading groups…' : ''}
      </p>
      {error !== null && data && <StaleNotice lastUpdated={lastUpdated} onRetry={refresh} />}
      {body}
    </section>
  );
}
