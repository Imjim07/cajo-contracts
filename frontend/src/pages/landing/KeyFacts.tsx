import type { ReactNode } from 'react';
import { CapIcon, LockIcon, NoKeyIcon, ScaleIcon } from '../../components/Icons';
import { CONTRACT_READ_URL, MAX_FEE_BPS } from '../../config';
import { formatBps } from '../../lib/format';

interface KeyFactsProps {
  feeBps: number | null;
  loading: boolean;
}

function LiveFee({ feeBps, loading }: KeyFactsProps) {
  if (loading) return <span className="fact-live">Reading current fee…</span>;
  if (feeBps === null) {
    return (
      <span className="fact-live fact-live-muted">
        Current fee unavailable.{' '}
        <a href={CONTRACT_READ_URL} target="_blank" rel="noopener noreferrer">
          Check feeBps on BscScan
        </a>
      </span>
    );
  }
  return (
    <span className="fact-live">
      <span className="live-dot" aria-hidden="true" />
      Current fee: {formatBps(feeBps)}
    </span>
  );
}

export function KeyFacts({ feeBps, loading }: KeyFactsProps) {
  const facts: Array<{ title: string; body: string; icon: ReactNode; extra?: ReactNode }> = [
    {
      title: 'Non-custodial',
      body: 'Funds sit in the contract, not with a person or company. Each member withdraws their own balance.',
      icon: <LockIcon />,
    },
    {
      title: 'Reverse-risk collateral',
      body: 'Early collectors lock bigger deposits because they owe the most after collecting. The last slot locks nothing.',
      icon: <ScaleIcon />,
    },
    {
      title: 'No admin or gatekeepers',
      body: 'No owner key, no pause switch, no approval queue. Time-based rules, not people, decide what can happen next.',
      icon: <NoKeyIcon />,
    },
    {
      title: 'Fee capped in code',
      body: `At most ${formatBps(MAX_FEE_BPS)}, fixed at deployment and immutable. Charged on payouts only.`,
      icon: <CapIcon />,
      extra: <LiveFee feeBps={feeBps} loading={loading} />,
    },
  ];

  return (
    <section className="section" aria-labelledby="facts-title">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Key facts</p>
          <h2 id="facts-title" className="section-title">
            The collector is code
          </h2>
        </div>
        <ul className="facts-grid">
          {facts.map((fact) => (
            <li key={fact.title} className="card fact-card reveal">
              <span className="fact-icon">{fact.icon}</span>
              <h3 className="card-title">{fact.title}</h3>
              <p className="muted">{fact.body}</p>
              {fact.extra}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
