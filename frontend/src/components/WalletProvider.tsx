import type { ReactNode } from 'react';
import { WalletContext, useWalletState } from '../useWallet';

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWalletState();
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>;
}
