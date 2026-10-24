import { useId, useState } from 'react';
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import {
  ILLUSTRATION_DECIMALS,
  MAX_MEMBERS,
  MIN_MEMBERS,
  illustrateDeposits,
  parseContribution,
  parseMembers,
} from '../../lib/collateral';
import { formatAmount } from '../../lib/format';

const MOBILE_VISIBLE = 8;

export function CollateralExplainer() {
  const contributionId = useId();
  const membersId = useId();
  const [contributionInput, setContributionInput] = useState('100');
  const [membersInput, setMembersInput] = useState('6');
  const [showAll, setShowAll] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const contribution = parseContribution(contributionInput);
  const members = parseMembers(membersInput);
  const slots = contribution.ok && members.ok ? illustrateDeposits(contribution.value, members.value) : [];

  const truncate = isMobile && !showAll && slots.length > MOBILE_VISIBLE;
  const visible = truncate ? slots.slice(0, MOBILE_VISIBLE) : slots;
  const amount = (value: bigint) => formatAmount(value, ILLUSTRATION_DECIMALS, ILLUSTRATION_DECIMALS);

  return (
    <section id="collateral" className="section" aria-labelledby="collateral-title">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Collateral</p>
          <h2 id="collateral-title" className="section-title">
            Collect early, lock more
          </h2>
          <p className="section-lead">
            A member who collects in round 1 still owes every later round. Their deposit covers exactly that, so a
            default can't leave the rest of the group short.
          </p>
        </div>

        <div className="card collateral reveal">
          <form className="collateral-inputs" onSubmit={(event) => event.preventDefault()} noValidate>
            <div className="field">
              <label htmlFor={contributionId}>Contribution per round</label>
              <input
                id={contributionId}
                inputMode="decimal"
                autoComplete="off"
                value={contributionInput}
                onChange={(event) => setContributionInput(event.target.value)}
                aria-invalid={!contribution.ok}
                aria-describedby={`${contributionId}-hint`}
              />
              <p id={`${contributionId}-hint`} className={contribution.ok ? 'field-hint' : 'field-error'}>
                {contribution.ok ? 'Any token amount, up to 2 decimals.' : contribution.error}
              </p>
            </div>
            <div className="field">
              <label htmlFor={membersId}>Members</label>
              <input
                id={membersId}
                type="number"
                inputMode="numeric"
                min={MIN_MEMBERS}
                max={MAX_MEMBERS}
                step={1}
                value={membersInput}
                onChange={(event) => setMembersInput(event.target.value)}
                aria-invalid={!members.ok}
                aria-describedby={`${membersId}-hint`}
              />
              <p id={`${membersId}-hint`} className={members.ok ? 'field-hint' : 'field-error'}>
                {members.ok ? `${MIN_MEMBERS} to ${MAX_MEMBERS}, as in the contract.` : members.error}
              </p>
            </div>
          </form>

          <p className="illustration-note">
            Illustration. Real values come from the contract's <code>slotDeposit</code>.
          </p>

          {slots.length > 0 ? (
            <>
              <p className="sr-only" aria-live="polite">
                Position 1 locks {amount(slots[0].deposit)}. The last position locks 0.
              </p>
              <ol className="bars" aria-label="Deposit by payout position">
                {visible.map((slot) => (
                  <li key={slot.position} className="bar-row">
                    <span className="bar-label">Position {slot.position}</span>
                    <span className="bar-track" aria-hidden="true">
                      <span className="bar-fill" style={{ transform: `scaleX(${slot.share})` }} />
                    </span>
                    <span className="bar-value">{amount(slot.deposit)}</span>
                  </li>
                ))}
              </ol>
              {isMobile && slots.length > MOBILE_VISIBLE && (
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show first 8 positions' : `Show all ${slots.length} positions`}
                </button>
              )}
            </>
          ) : (
            <p className="muted">Fix the inputs above to see the illustration.</p>
          )}
        </div>
      </div>
    </section>
  );
}
