import { useEffect, useState } from 'react';
import { setHash } from '../lib/scroll';

const TOP_THRESHOLD_PX = 24;

/**
 * Scroll-spy: tracks which section sits in the middle band of the viewport.
 * At the very top the first id ("home") wins and the URL hash is cleared.
 * `ids` must be a stable array. Returns null while disabled.
 */
export function useActiveSection(ids: readonly string[], enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    if (!enabled) return;
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              if (window.scrollY <= TOP_THRESHOLD_PX) return;
              for (const entry of entries) {
                if (entry.isIntersecting) setActive(entry.target.id);
              }
            },
            { rootMargin: '-45% 0px -50% 0px' },
          )
        : null;
    sections.forEach((section) => observer?.observe(section));

    // Clear the hash only once scrolling settles at the top; clearing on the first
    // event would wipe the hash a nav click just set as its smooth scroll begins.
    let settleTimer: number | undefined;
    const handleScroll = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (window.scrollY <= TOP_THRESHOLD_PX) setHash(null);
      }, 200);
      if (window.scrollY <= TOP_THRESHOLD_PX) {
        setActive(sections[0].id);
        return;
      }
      // The last section can be too short to ever reach the middle band.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) setActive(sections[sections.length - 1].id);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer?.disconnect();
      window.clearTimeout(settleTimer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [ids, enabled]);

  return enabled ? active : null;
}
