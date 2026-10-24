export class AbortedError extends Error {
  constructor() {
    super('Request cancelled');
    this.name = 'AbortError';
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Caps how many async tasks run at once. Queued tasks whose signal is aborted
 * before they start are dropped, so stale polls never hit the RPC.
 */
export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const startNext = () => {
    if (active >= maxConcurrent) return;
    queue.shift()?.();
  };

  return function limit<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        if (signal?.aborted) {
          reject(new AbortedError());
          startNext();
          return;
        }
        active++;
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            startNext();
          });
      });
      startNext();
    });
  };
}
