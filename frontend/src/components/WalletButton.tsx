import { CHAIN, METAMASK_DOWNLOAD_URL } from '../config';
import { shortenAddress } from '../lib/format';
import { useWallet } from '../useWallet';

export function WalletButton({ className = '' }: { className?: string }) {
  const wallet = useWallet();
  const classes = (variant: string) => `btn ${variant} ${className}`.trim();

  if (wallet.status === 'unavailable') {
    return (
      <a
        className={classes('btn-primary')}
        href={METAMASK_DOWNLOAD_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Install MetaMask (opens in a new tab)"
      >
        Install MetaMask
      </a>
    );
  }

  if (wallet.status === 'connected' && wallet.account) {
    if (!wallet.isCorrectChain) {
      return (
        <button
          type="button"
          className={classes('btn-warn')}
          onClick={() => void wallet.switchNetwork()}
          disabled={wallet.isSwitching}
          aria-busy={wallet.isSwitching}
          aria-label={`Switch to ${CHAIN.shortName}`}
        >
          {wallet.isSwitching && <span className="spinner" aria-hidden="true" />}
          <span className="label-full">{wallet.isSwitching ? 'Switching…' : `Switch to ${CHAIN.shortName}`}</span>
          <span className="label-short" aria-hidden="true">
            {wallet.isSwitching ? 'Switching…' : 'Switch network'}
          </span>
        </button>
      );
    }
    return (
      <span className={classes('btn-account')} title={wallet.account}>
        <span className="account-dot" aria-hidden="true" />
        <span className="sr-only">Connected wallet </span>
        {shortenAddress(wallet.account)}
      </span>
    );
  }

  const connecting = wallet.status === 'connecting';
  return (
    <button
      type="button"
      className={classes('btn-primary')}
      onClick={() => void wallet.connect()}
      disabled={connecting}
      aria-busy={connecting}
      aria-label={connecting ? 'Connecting wallet' : 'Connect wallet'}
    >
      {connecting && <span className="spinner" aria-hidden="true" />}
      {connecting ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}
