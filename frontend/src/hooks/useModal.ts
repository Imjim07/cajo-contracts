import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behaviour for sheets: traps Tab inside `ref`, closes on Escape, locks page
 * scroll, and returns focus to whatever was focused before opening.
 */
export function useModal(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  useEffect(() => {
    const container = ref.current;
    if (!open || !container) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    (container.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? container).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      root.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [ref, open, onClose]);
}
