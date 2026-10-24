import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon } from './Icons';

interface CopyButtonProps {
  value: string;
  /** What is being copied, e.g. "contract address". */
  label: string;
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <>
      <button type="button" className="icon-btn" onClick={() => void copy()} aria-label={`Copy ${label}`}>
        {status === 'copied' ? <CheckIcon /> : <CopyIcon />}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'copied' ? `Copied ${label}` : status === 'failed' ? 'Copy failed' : ''}
      </span>
    </>
  );
}
