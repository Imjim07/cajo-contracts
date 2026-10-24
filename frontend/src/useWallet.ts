import { BrowserProvider, getAddress } from 'ethers';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CHAIN, EXPLORER_URL, PUBLIC_RPC_URL } from './config';
import { describeWalletError, isUnknownChainError } from './lib/walletErrors';

export type WalletStatus = 'unavailable' | 'disconnected' | 'connecting' | 'connected';

export interface WalletMessage {
  tone: 'info' | 'error';
  text: string;
}

export interface Wallet {
  status: WalletStatus;
  account: string | null;
  chainId: number | null;
  isCorrectChain: boolean;
  isSwitching: boolean;
  message: WalletMessage | null;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  dismissMessage: () => void;
}

const INFO_MESSAGE_MS = 4000;

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

// Lowercase first: getAddress throws on mixed case with a bad checksum, which some wallets return.
function firstAccount(accounts: readonly string[]): string | null {
  return accounts.length > 0 ? getAddress(accounts[0].toLowerCase()) : null;
}

function parseChainId(hex: string): number {
  return Number.parseInt(hex, 16);
}

/** Wallet state for the whole app. Read-only: it never sends transactions or touches keys. */
export function useWalletState(): Wallet {
  const [status, setStatus] = useState<WalletStatus>(() => (window.ethereum ? 'disconnected' : 'unavailable'));
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [message, setMessage] = useState<WalletMessage | null>(null);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;
    let cancelled = false;

    // eth_accounts never prompts; it restores a session the user already approved.
    Promise.all([ethereum.request({ method: 'eth_accounts' }), ethereum.request({ method: 'eth_chainId' })])
      .then(([accounts, chainHex]) => {
        if (cancelled) return;
        const restored = firstAccount(toStringArray(accounts));
        setAccount(restored);
        setStatus(restored ? 'connected' : 'disconnected');
        if (typeof chainHex === 'string') setChainId(parseChainId(chainHex));
      })
      .catch(() => {
        // A failed silent check just leaves the user disconnected.
      });

    const handleAccountsChanged = (accounts: string[]) => {
      const next = firstAccount(accounts);
      setAccount(next);
      setStatus(next ? 'connected' : 'disconnected');
      if (!next) setMessage({ tone: 'info', text: 'Wallet disconnected.' });
    };
    const handleChainChanged = (chainHex: string) => setChainId(parseChainId(chainHex));

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);
    return () => {
      cancelled = true;
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  useEffect(() => {
    if (message?.tone !== 'info') return;
    const timer = window.setTimeout(() => setMessage(null), INFO_MESSAGE_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const connect = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) return;
    setStatus('connecting');
    setMessage(null);
    try {
      const provider = new BrowserProvider(ethereum);
      const accounts: unknown = await provider.send('eth_requestAccounts', []);
      const network = await provider.getNetwork();
      const next = firstAccount(toStringArray(accounts));
      setAccount(next);
      setChainId(Number(network.chainId));
      setStatus(next ? 'connected' : 'disconnected');
      if (next) setMessage({ tone: 'info', text: 'Wallet connected.' });
    } catch (err) {
      setStatus('disconnected');
      setMessage({ tone: 'error', text: describeWalletError(err, 'Connection request was cancelled.') });
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) return;
    setIsSwitching(true);
    setMessage(null);
    try {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN.idHex }] });
      setMessage({ tone: 'info', text: `Switched to ${CHAIN.shortName}.` });
    } catch (err) {
      if (!isUnknownChainError(err)) {
        setMessage({ tone: 'error', text: describeWalletError(err, 'Network switch was cancelled.') });
        return;
      }
      // 4902: the wallet has never seen chain 97, so offer to add it (MetaMask then switches).
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: CHAIN.idHex,
              chainName: CHAIN.name,
              nativeCurrency: CHAIN.nativeCurrency,
              // Always the public endpoint: a custom VITE_RPC_URL may carry an API key.
              rpcUrls: [PUBLIC_RPC_URL],
              blockExplorerUrls: [EXPLORER_URL],
            },
          ],
        });
        setMessage({ tone: 'info', text: `${CHAIN.shortName} added to your wallet.` });
      } catch (addErr) {
        setMessage({ tone: 'error', text: describeWalletError(addErr, 'Adding BSC Testnet was cancelled.') });
      }
    } finally {
      setIsSwitching(false);
    }
  }, []);

  const dismissMessage = useCallback(() => setMessage(null), []);

  return {
    status,
    account,
    chainId,
    isCorrectChain: chainId === CHAIN.id,
    isSwitching,
    message,
    connect,
    switchNetwork,
    dismissMessage,
  };
}

export const WalletContext = createContext<Wallet | null>(null);

export function useWallet(): Wallet {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error('useWallet must be used inside <WalletProvider>');
  return wallet;
}
