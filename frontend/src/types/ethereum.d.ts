// Minimal EIP-1193 provider shape injected by MetaMask and compatible wallets.

interface EthereumRequestArguments {
  readonly method: string;
  readonly params?: readonly unknown[] | Readonly<Record<string, unknown>>;
}

interface EthereumProvider {
  readonly isMetaMask?: boolean;
  request(args: EthereumRequestArguments): Promise<unknown>;
  on(event: 'accountsChanged', listener: (accounts: string[]) => void): void;
  on(event: 'chainChanged', listener: (chainIdHex: string) => void): void;
  removeListener(event: 'accountsChanged', listener: (accounts: string[]) => void): void;
  removeListener(event: 'chainChanged', listener: (chainIdHex: string) => void): void;
}

interface Window {
  ethereum?: EthereumProvider;
}
