import { useEffect, type RefObject } from 'react';

/**
 * Adds `is-visible` to each `.reveal` element inside `rootRef` the first time it
 * scrolls into view. Elements are only hidden once `motion-ok` is on <html>, so
 * content stays visible without JS, without IntersectionObserver, or with reduced motion.
 */
export function useRevealOnScroll(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!root || reducedMotion || !('IntersectionObserver' in window)) return;

    const html = document.documentElement;
    html.classList.add('motion-ok');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    root.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      html.classList.remove('motion-ok');
    };
  }, [rootRef]);
}
