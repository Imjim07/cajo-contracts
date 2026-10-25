import { getAddress, isAddress } from 'ethers';

// Every on-chain and external constant lives here. BSC Testnet only.

function envValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const CHAIN = {
  id: 97,
  idHex: '0x61',
  name: 'BNB Smart Chain Testnet',
  shortName: 'BSC Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
} as const;

// Public BSC Testnet endpoint. Check it against the official BNB Chain docs
// (https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/)
// before relying on it; endpoints change. Override with VITE_RPC_URL.
export const PUBLIC_RPC_URL = 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';
export const RPC_URL = envValue(import.meta.env.VITE_RPC_URL) ?? PUBLIC_RPC_URL;

export const DEPLOYED_CAJO_ADDRESS = '0xc9d30A50579Fbd7aEDb48a4E7F02Eab56C3298b4';
const addressOverride = envValue(import.meta.env.VITE_CAJO_ADDRESS);
// The override exists only for pointing the UI at a local test deployment.
export const CAJO_ADDRESS =
  addressOverride && isAddress(addressOverride) ? getAddress(addressOverride) : DEPLOYED_CAJO_ADDRESS;

export const EXPLORER_URL = 'https://testnet.bscscan.com';
export const REPO_URL = 'https://github.com/Imjim07/cajo-contracts';
export const METAMASK_DOWNLOAD_URL = 'https://metamask.io/download/';
export const FAUCET_URL = 'https://www.bnbchain.org/en/testnet-faucet';

export const MAX_FEE_BPS = 300;
export const POLL_INTERVAL_MS = 15_000;
export const MAX_CONCURRENT_RPC = 5;
export const RECENT_GROUP_LIMIT = 20;

// Any ERC-20 can back a group. Tokens not listed here get a warning badge.
// Keys are lowercase. All verified on-chain (symbol + decimals) on BSC Testnet.
export const TOKEN_ALLOWLIST: Readonly<Record<string, string>> = {
  '0x337610d27c682e347c9cd60bd4b3b107c9d34ddd': 'USDT (BNB Chain testnet faucet)',
  '0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee': 'BUSD (BNB Chain testnet faucet)',
  // Deployed by scripts/demoSetup.ts: the repo's MockUSDT (mintable test token), backing demo group #3.
  '0x8eeaef54210eb230ffe0c17fba9021dc9bd7e535': 'CAjo demo token (MockUSDT, testnet only)',
};

export function isAllowlistedToken(address: string): boolean {
  return address.toLowerCase() in TOKEN_ALLOWLIST;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export const CONTRACT_EXPLORER_URL = explorerAddressUrl(CAJO_ADDRESS);
export const CONTRACT_READ_URL = `${CONTRACT_EXPLORER_URL}#readContract`;
