import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useActiveSection } from '../hooks/useActiveSection';
import { BELOW_DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useModal } from '../hooks/useModal';
import { useScrolled } from '../hooks/useScrolled';
import { scrollToSection } from '../lib/scroll';
import { useWallet } from '../useWallet';
import { CloseIcon, MenuIcon } from './Icons';
import { LogoMark } from './Logo';
import { NetworkPill } from './NetworkPill';
import { WalletButton } from './WalletButton';

const NAV_LINKS = [
  { id: 'home', label: 'Home' },
  { id: 'how', label: 'How it works' },
  { id: 'collateral', label: 'Collateral' },
  { id: 'safety', label: 'Safety' },
  { id: 'faq', label: 'FAQ' },
] as const;

const SECTION_IDS: readonly string[] = NAV_LINKS.map((link) => link.id);

interface NavLinksProps {
  onLanding: boolean;
  activeId: string | null;
  onNavigate: () => void;
  onSection: (id: string) => void;
}

// On "/" links scroll to sections; elsewhere they route back to "/#section".
function NavLinks({ onLanding, activeId, onNavigate, onSection }: NavLinksProps) {
  return (
    <ul className="nav-list">
      {NAV_LINKS.map((link) => (
        <li key={link.id}>
          {onLanding ? (
            <a
              className="nav-link"
              href={`#${link.id}`}
              aria-current={activeId === link.id ? 'location' : undefined}
              onClick={(event) => {
                event.preventDefault();
                onSection(link.id);
              }}
            >
              {link.label}
            </a>
          ) : (
            <Link className="nav-link" to={`/#${link.id}`} onClick={onNavigate}>
              {link.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function WalletMessageRegion() {
  const { message, dismissMessage } = useWallet();
  return (
    <div className="wallet-message-region" role="status" aria-live="polite">
      {message && (
        <p className={`wallet-message wallet-message-${message.tone}`}>
          <span>{message.text}</span>
          <button type="button" className="icon-btn icon-btn-sm" onClick={dismissMessage} aria-label="Dismiss message">
            <CloseIcon size={16} />
          </button>
        </p>
      )}
    </div>
  );
}

export function Navbar() {
  const { pathname } = useLocation();
  const onLanding = pathname === '/';
  const activeId = useActiveSection(SECTION_IDS, onLanding);
  const scrolled = useScrolled(24);
  const belowDesktop = useMediaQuery(BELOW_DESKTOP_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const sheetOpen = menuOpen && belowDesktop;
  useModal(sheetRef, sheetOpen, closeMenu);

  // From the sheet, scroll only after it has closed and restored focus; otherwise
  // that focus restore would pull focus back off the section heading.
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  const goToSection = useCallback(
    (id: string) => {
      if (sheetOpen) {
        setPendingSection(id);
        setMenuOpen(false);
      } else {
        scrollToSection(id);
      }
    },
    [sheetOpen],
  );
  useEffect(() => {
    if (pendingSection && !sheetOpen) {
      scrollToSection(pendingSection);
      setPendingSection(null);
    }
  }, [pendingSection, sheetOpen]);

  useEffect(() => {
    if (!belowDesktop) setMenuOpen(false);
  }, [belowDesktop]);

  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onLanding) {
      event.preventDefault();
      scrollToSection('home');
    }
  };

  return (
    <header className={`navbar${scrolled ? ' is-scrolled' : ''}`}>
      <Link className="brand" to="/" onClick={handleBrandClick} aria-label="CÀjọ home">
        <LogoMark />
        <span className="brand-name">CÀjọ</span>
      </Link>

      <nav className="nav-desktop" aria-label="Primary">
        <NavLinks onLanding={onLanding} activeId={activeId} onNavigate={closeMenu} onSection={goToSection} />
      </nav>

      <div className="nav-actions">
        <NetworkPill className="nav-pill" />
        <WalletButton className="nav-wallet" />
        <button
          type="button"
          className="icon-btn menu-toggle"
          aria-label="Open menu"
          aria-expanded={sheetOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen(true)}
        >
          <MenuIcon />
        </button>
      </div>

      <WalletMessageRegion />

      {/* Portalled: the header's backdrop-filter would otherwise trap a fixed child. */}
      {sheetOpen &&
        createPortal(
          <div id="mobile-menu" ref={sheetRef} className="menu-sheet" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="menu-sheet-head">
              <span className="brand" aria-hidden="true">
                <LogoMark />
                <span className="brand-name">CÀjọ</span>
              </span>
              <button type="button" className="icon-btn" onClick={closeMenu} aria-label="Close menu" data-autofocus>
                <CloseIcon />
              </button>
            </div>
            <nav aria-label="Primary">
              <NavLinks onLanding={onLanding} activeId={activeId} onNavigate={closeMenu} onSection={goToSection} />
            </nav>
            <div className="menu-sheet-foot">
              <NetworkPill />
              <WalletButton className="btn-block" />
              <Link className="btn btn-secondary btn-block" to="/app" onClick={closeMenu}>
                Open dashboard
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
