const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Replaces the hash without adding history entries; keeps React Router's history.state intact. */
export function setHash(id: string | null): void {
  const url = `${location.pathname}${location.search}${id ? `#${id}` : ''}`;
  if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url);
}

/**
 * Scrolls to a landing section (smooth, or instant under reduced motion), updates the
 * hash, then moves focus to the section heading so keyboard and screen-reader users land there.
 */
export function scrollToSection(id: string): boolean {
  const section = document.getElementById(id);
  if (!section) return false;
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'instant' : 'smooth';

  if (id === 'home') {
    window.scrollTo({ top: 0, behavior });
    setHash(null);
  } else {
    section.scrollIntoView({ behavior, block: 'start' });
    setHash(id);
  }

  const heading = section.querySelector<HTMLElement>('h1, h2');
  if (heading) {
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  return true;
}
