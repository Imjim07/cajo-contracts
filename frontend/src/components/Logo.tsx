// Ring = the savings circle; the bead on top = whoever collects this round.
export function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <circle cx="16" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.35" />
      <circle cx="16" cy="5" r="3.6" fill="currentColor" stroke="var(--bg-frame)" strokeWidth="1.6" />
    </svg>
  );
}
