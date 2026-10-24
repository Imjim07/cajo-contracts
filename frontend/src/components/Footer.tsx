import { Link } from 'react-router-dom';
import { CONTRACT_EXPLORER_URL, REPO_URL } from '../config';
import { ExternalIcon } from './Icons';
import { LogoMark } from './Logo';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Link className="brand" to="/" aria-label="CÀjọ home">
            <LogoMark />
            <span className="brand-name">CÀjọ</span>
          </Link>
          <p className="footer-note">Built as a portfolio and learning project.</p>
        </div>

        <div className="footer-disclaimer">
          <h2 className="footer-heading">Disclaimer</h2>
          <p>
            CÀjọ runs on BSC Testnet only. The contract is self-audited and has not been independently audited. Do not
            use real funds. Nothing on this site is financial advice.
          </p>
        </div>

        <nav className="footer-links" aria-label="Project links">
          <h2 className="footer-heading">Links</h2>
          <ul>
            <li>
              <Link to="/app">Dashboard</Link>
            </li>
            <li>
              <a href={CONTRACT_EXPLORER_URL} target="_blank" rel="noopener noreferrer">
                Contract on BscScan <ExternalIcon />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                Source on GitHub <ExternalIcon />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
