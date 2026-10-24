import { WarningIcon } from '../../components/Icons';

const RULES = [
  {
    title: 'If someone stops paying',
    body: 'Once the round deadline and the grace period have passed, anyone can remove a member who has not paid. Their deposit is seized. It first repairs any earlier payout that came up short, then the rest is spread over the remaining pots.',
  },
  {
    title: "If a group never fills",
    body: 'After the fill deadline, anyone can cancel an unfilled group. Every member who joined can then reclaim their deposit.',
  },
  {
    title: 'How money leaves the contract',
    body: 'Only through withdraw(), which each person calls for their own credited balance. No one can send your funds anywhere else.',
  },
] as const;

export function Safety() {
  return (
    <section id="safety" className="section section-alt" aria-labelledby="safety-title">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Safety</p>
          <h2 id="safety-title" className="section-title">
            Rules for when things go wrong
          </h2>
          <p className="section-lead">Every rule below is enforced by the contract and can be triggered by anyone.</p>
        </div>

        <ul className="rules">
          {RULES.map((rule) => (
            <li key={rule.title} className="card rule reveal">
              <h3 className="card-title">{rule.title}</h3>
              <p className="muted">{rule.body}</p>
            </li>
          ))}
        </ul>

        <aside className="callout callout-warn reveal" aria-labelledby="not-title">
          <WarningIcon size={20} />
          <div>
            <h3 id="not-title" className="card-title">
              What this is not
            </h3>
            <ul className="plain-list">
              <li>Not independently audited. The contract is self-audited only.</li>
              <li>Not on mainnet. It runs on BSC Testnet with test tokens.</li>
              <li>Not for real funds. Bugs may exist, and nothing here is financial advice.</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
