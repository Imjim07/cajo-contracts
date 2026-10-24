type ErrorCode = number | string;

function child(value: unknown, key: string): unknown {
  if (typeof value === 'object' && value !== null && key in value) {
    return (value as Record<string, unknown>)[key];
  }
  return undefined;
}

function codeOf(value: unknown): ErrorCode | undefined {
  const code = child(value, 'code');
  return typeof code === 'number' || typeof code === 'string' ? code : undefined;
}

// ethers and different wallets nest the original RPC error in different places,
// so check every known location rather than only the top-level code.
function collectCodes(err: unknown): ErrorCode[] {
  const candidates = [
    err,
    child(err, 'error'),
    child(child(err, 'info'), 'error'),
    child(child(err, 'data'), 'originalError'),
  ];
  return candidates.map(codeOf).filter((code): code is ErrorCode => code !== undefined);
}

export function isUserRejection(err: unknown): boolean {
  return collectCodes(err).some((code) => code === 4001 || code === 'ACTION_REJECTED');
}

export function isUnknownChainError(err: unknown): boolean {
  return collectCodes(err).includes(4902);
}

export function describeWalletError(err: unknown, rejectedText: string): string {
  if (isUserRejection(err)) return rejectedText;
  if (collectCodes(err).includes(-32002)) {
    return 'MetaMask already has a request open. Check the extension to continue.';
  }
  return 'Your wallet returned an error. Please try again.';
}
