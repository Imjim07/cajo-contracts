import { AddressDisplay } from '../../components/AddressDisplay';
import { formatTokenAmount } from '../../lib/format';
import type { GroupRecord, SlotInfo, TokenInfo } from '../../types/cajo';

interface SlotGridProps {
  group: GroupRecord;
  token: TokenInfo;
  slots: SlotInfo[];
  account: string | null;
  /** Shown on open slots while the group is Open. */
  onJoin?: (position: number) => void;
}

export function SlotGrid({ group, token, slots, account, onJoin }: SlotGridProps) {
  const isActive = group.state === 'Active';

  if (slots.length === 0) return <p className="muted">This group has no slots.</p>;

  return (
    <>
      <ul className="slot-grid">
        {slots.map((slot) => {
          const holder = slot.holder;
          const isMine = holder !== null && account !== null && holder.address === account;
          const collectsNow = isActive && slot.position === group.currentRound;
          const paidThisRound = holder !== null && holder.roundsPaid >= group.currentRound;
          return (
            <li
              key={slot.position}
              className={`slot${slot.taken ? ' is-taken' : ' is-open'}${collectsNow ? ' is-current' : ''}`}
            >
              <div className="slot-head">
                <span className="slot-number">Slot {slot.position}</span>
                <span className={`badge ${slot.taken ? 'badge-neutral' : 'badge-info'}`}>
                  {slot.taken ? 'Taken' : 'Open'}
                </span>
              </div>

              {holder ? (
                <>
                  <AddressDisplay address={holder.address} label={`slot ${slot.position} holder`} />
                  <div className="slot-tags">
                    {isMine && <span className="badge badge-accent">You</span>}
                    {collectsNow && <span className="badge badge-ok">Collects this round</span>}
                    {holder.state === 'Defaulted' && <span className="badge badge-danger">Defaulted</span>}
                    {holder.payoutReceived && <span className="badge badge-neutral">Collected</span>}
                    {isActive && holder.state === 'Active' && (
                      <span className={`badge ${paidThisRound ? 'badge-ok' : 'badge-muted'}`}>
                        {paidThisRound ? `Paid round ${group.currentRound}` : 'Not paid yet'}
                      </span>
                    )}
                  </div>
                </>
              ) : onJoin && !slot.taken ? (
                <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={() => onJoin(slot.position)}>
                  Join slot {slot.position}
                </button>
              ) : (
                <p className="slot-empty">{slot.taken ? 'Holder unavailable' : 'No holder yet'}</p>
              )}

              <dl className="slot-amounts">
                <div>
                  <dt>Deposit</dt>
                  <dd>{slot.deposit === null ? 'Unavailable' : formatTokenAmount(slot.deposit, token)}</dd>
                </div>
                {holder && slot.deposit !== null && holder.escrowBalance !== slot.deposit && (
                  <div>
                    <dt>In escrow</dt>
                    <dd>{formatTokenAmount(holder.escrowBalance, token)}</dd>
                  </div>
                )}
              </dl>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Deposit is <code>slotDeposit</code> for the group's current size. After a default the group shrinks, so a
        holder's escrow can differ from it.
      </p>
    </>
  );
}
