import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePolledResource } from '../../hooks/usePolledResource';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { fetchLandingStats } from '../../lib/cajo';
import { CollateralExplainer } from './CollateralExplainer';
import { Faq } from './Faq';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { KeyFacts } from './KeyFacts';
import { LiveTeaser } from './LiveTeaser';
import { Safety } from './Safety';

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  // One read on load; the landing page doesn't need live polling.
  const stats = usePolledResource('landing-stats', fetchLandingStats, null);

  useRevealOnScroll(rootRef);

  // Arriving from another route with "/#section": jump once the sections exist.
  // Instant on purpose: scroll-spy would otherwise see the top of the page mid-animation.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'instant' });
  }, [hash]);

  return (
    <div ref={rootRef} className="landing">
      <Hero groupCount={stats.data?.groupCount ?? null} feeBps={stats.data?.feeBps ?? null} loading={stats.isLoading} />
      <KeyFacts feeBps={stats.data?.feeBps ?? null} loading={stats.isLoading} />
      <HowItWorks />
      <CollateralExplainer />
      <Safety />
      <LiveTeaser groupCount={stats.data?.groupCount ?? null} loading={stats.isLoading} />
      <Faq feeBps={stats.data?.feeBps ?? null} />
    </div>
  );
}
