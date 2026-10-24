import { Link } from 'react-router-dom';
import { AddressDisplay } from '../../components/AddressDisplay';
import { CAJO_ADDRESS, CHAIN } from '../../config';

interface LiveTeaserProps {
  groupCount: bigint | null;
  loading: boolean;
}

export function LiveTeaser({ groupCount, loading }: LiveTeaserProps) {
  const countText = loading ? '…' : groupCount === null ? 'Unavailable' : groupCount.toString();

  return (
    <section className="section" aria-labelledby="live-title">
      <div className="container">
        <div className="card teaser reveal">
          <div className="teaser-copy">
            <p className="eyebrow">
              <span className="live-dot" aria-hidden="true" /> On {CHAIN.shortName} now
            </p>
            <h2 id="live-title" className="section-title">
              Read the contract live
            </h2>
            <p className="muted">
              The dashboard reads groups, rounds and slots straight from the chain. No wallet needed to look around.
            </p>
          </div>

          <dl className="teaser-stats">
            <div>
              <dt>Groups created</dt>
              <dd className="stat-value" aria-live="polite" aria-busy={loading}>
                {countText}
              </dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>
                <AddressDisplay address={CAJO_ADDRESS} label="contract address" />
              </dd>
            </div>
          </dl>

          <Link className="btn btn-primary btn-lg teaser-cta" to="/app">
            Open dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
