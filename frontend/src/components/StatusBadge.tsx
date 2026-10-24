import type { GroupState } from '../types/cajo';

const TONE: Record<GroupState, string> = {
  Open: 'badge-info',
  Active: 'badge-ok',
  Completed: 'badge-neutral',
  Cancelled: 'badge-muted',
  Unknown: 'badge-warn',
};

export function StatusBadge({ state }: { state: GroupState }) {
  return <span className={`badge ${TONE[state]}`}>{state}</span>;
}
