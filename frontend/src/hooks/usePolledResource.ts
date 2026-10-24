import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '../lib/limiter';

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  /** True only while there is no data yet. */
  isLoading: boolean;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
}

interface State<T> {
  key: string | null;
  data: T | undefined;
  error: unknown;
  pending: boolean;
  lastUpdated: Date | null;
}

/**
 * Fetches `fetcher` for `key`, then re-fetches every `intervalMs` (null = once).
 * Pauses while the tab is hidden and refreshes on return. A key change or refresh
 * aborts the in-flight request, so stale responses are never applied.
 */
export function usePolledResource<T>(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalMs: number | null,
): Resource<T> {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({
    key,
    data: undefined,
    error: null,
    pending: key !== null,
    lastUpdated: null,
  });

  useEffect(() => {
    if (key === null) return;
    let controller: AbortController | null = null;
    let timer: number | undefined;
    let disposed = false;

    const schedule = () => {
      if (intervalMs === null || disposed || document.hidden) return;
      timer = window.setTimeout(() => void run(), intervalMs);
    };

    const run = async () => {
      window.clearTimeout(timer);
      controller?.abort();
      const current = new AbortController();
      controller = current;
      setState((s) =>
        s.key === key
          ? { ...s, pending: true }
          : { key, data: undefined, error: null, pending: true, lastUpdated: null },
      );
      try {
        const data = await fetcherRef.current(current.signal);
        if (disposed || current.signal.aborted) return;
        setState({ key, data, error: null, pending: false, lastUpdated: new Date() });
      } catch (error) {
        if (disposed || current.signal.aborted || isAbortError(error)) return;
        // Keep the last good data on screen; the caller shows the error beside it.
        setState((s) => ({ ...s, key, error, pending: false }));
      }
      schedule();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
      } else if (intervalMs !== null) {
        void run();
      }
    };

    void run();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [key, intervalMs, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.key === key;
  const data = current ? state.data : undefined;
  const error = current ? state.error : null;

  return {
    data,
    error,
    isLoading: key !== null && data === undefined && error === null,
    isRefreshing: current && state.pending && data !== undefined,
    lastUpdated: current ? state.lastUpdated : null,
    refresh,
  };
}
