import { CHAIN } from '../config';
import { useWallet } from '../useWallet';

export function NetworkPill({ className = '' }: { className?: string }) {
  const wallet = useWallet();
  const wrong = wallet.status === 'connected' && !wallet.isCorrectChain;

  return (
    <span className={`pill ${wrong ? 'pill-warn' : 'pill-ok'} ${className}`.trim()}>
      <span className="pill-dot" aria-hidden="true" />
      {wrong ? 'Wrong network' : CHAIN.shortName}
    </span>
  );
}
