import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../components/Feedback';
import {
  GroupsIcon,
  LockIcon,
  PercentIcon,
  PotIcon,
  RepeatIcon,
  ShieldIcon,
  SparkleIcon,
  WarningIcon,
} from '../../components/Icons';
import { LogoMark } from '../../components/Logo';
import { formatBps } from '../../lib/format';
import { scrollToSection } from '../../lib/scroll';

const HIGHLIGHTED_CELLS = 6;

// Grid areas a-d place the cards left and right of the node on desktop.
const CONCEPTS: Array<{ area: string; text: string; icon: ReactNode }> = [
  { area: 'a', text: 'Fixed contribution each round', icon: <RepeatIcon /> },
  { area: 'b', text: 'One member collects the pot', icon: <PotIcon /> },
  { area: 'c', text: 'Deposit locked per slot', icon: <LockIcon size={18} /> },
  { area: 'd', text: 'Defaults handled on-chain', icon: <ShieldIcon /> },
];

interface HeroProps {
  groupCount: bigint | null;
  feeBps: number | null;
  loading: boolean;
}

/** Loading shows a skeleton, a failed read shows a dash. Never a made-up number. */
function LiveValue({ loading, value }: { loading: boolean; value: string | null }) {
  if (loading) return <Skeleton width="2.5em" height="1.1em" />;
  return <>{value ?? '—'}</>;
}

/** Horizontal SVG connector with endpoint dots; only shown in the desktop layout. */
function Connector({ area }: { area: string }) {
  return (
    <span className={`orbit-link orbit-link-${area}`} aria-hidden="true">
      <svg viewBox="0 0 100 2" preserveAspectRatio="none" focusable="false">
        <line x1="0" y1="1" x2="100" y2="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="orbit-dot orbit-dot-start" />
      <span className="orbit-dot orbit-dot-end" />
    </span>
  );
}

export function Hero({ groupCount, feeBps, loading }: HeroProps) {
  const goToHow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    scrollToSection('how');
  };

  return (
    <section id="home" className="hero" aria-labelledby="hero-title">
      <div className="hero-grid" aria-hidden="true">
        {Array.from({ length: HIGHLIGHTED_CELLS }, (_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="container hero-inner">
        <div className="hero-content">
          <p className="hero-badge">
            <SparkleIcon />
            Live on BSC Testnet
          </p>

          <h1 id="hero-title" className="hero-title">
            Your savings circle, now <strong>trustless</strong>.
          </h1>

          <p className="hero-subtitle">
            CÀjọ puts the traditional Ajo on BNB Smart Chain. A smart contract holds the funds, enforces the payout
            order and handles defaults, with no admin and no custody.
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/app">
              Open dashboard
            </Link>
            <a className="btn btn-secondary btn-lg" href="#how" onClick={goToHow}>
              How it works
            </a>
          </div>

          <p className="hero-caution">
            <WarningIcon size={15} />
            Testnet only. Not independently audited. Do not use real funds.
          </p>
        </div>

        <figure className="orbit">
          <figcaption className="sr-only">
            How the CÀjọ contract works: fixed contributions each round, one member collects the pot, a deposit is
            locked per slot, and defaults are handled on-chain.
          </figcaption>

          <div className="orbit-node">
            <span className="orbit-ring" aria-hidden="true" />
            <LogoMark />
            <span className="orbit-node-label">CÀjọ contract</span>
          </div>

          {CONCEPTS.map((concept) => (
            <Connector key={concept.area} area={concept.area} />
          ))}

          {CONCEPTS.map((concept) => (
            <div key={concept.text} className={`orbit-card orbit-card-${concept.area}`}>
              <span className="orbit-icon">{concept.icon}</span>
              <span>{concept.text}</span>
            </div>
          ))}

          <dl className="orbit-live" aria-busy={loading}>
            <div className="orbit-card orbit-card-live">
              <dt>
                <span className="orbit-icon">
                  <GroupsIcon />
                </span>
                Groups on testnet
              </dt>
              <dd className="orbit-value">
                <LiveValue loading={loading} value={groupCount === null ? null : groupCount.toString()} />
              </dd>
            </div>
            <div className="orbit-card orbit-card-live">
              <dt>
                <span className="orbit-icon">
                  <PercentIcon />
                </span>
                Current fee
              </dt>
              <dd className="orbit-value">
                <LiveValue loading={loading} value={feeBps === null ? null : formatBps(feeBps)} />
              </dd>
            </div>
          </dl>
        </figure>
      </div>
    </section>
  );
}
