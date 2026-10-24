# CÀjọ frontend

The web app for [CÀjọ](../README.md), a trustless rotating savings protocol (Ajo / Esusu / ROSCA) on BNB Smart Chain.
It reads live data from the deployed contract and lets anyone inspect groups, rounds and payout slots.

> **BSC Testnet only.** The contract is self-audited and not independently audited. Do not use real funds.
> This version is **read-only**: it never sends a transaction.

- Contract: [`0xc9d30A50579Fbd7aEDb48a4E7F02Eab56C3298b4`](https://testnet.bscscan.com/address/0xc9d30A50579Fbd7aEDb48a4E7F02Eab56C3298b4#readContract) (chain ID 97)
- Stack: React 19, TypeScript (strict, no `any`), Vite, react-router, ethers v6, plain CSS with variables

## Run it

Requires Node 20 (the repo has an `.nvmrc`).

```bash
cd frontend
nvm use          # or install Node 20 another way
npm install
npm run dev      # http://localhost:5173
```

Optional settings go in `frontend/.env.local` (see [`.env.example`](.env.example)). Every `VITE_*` value is bundled
into public JavaScript, so never put keys or secrets there.

| Variable | Purpose |
|---|---|
| `VITE_RPC_URL` | BSC Testnet RPC for reads. Defaults to a public endpoint in [`src/config.ts`](src/config.ts). |
| `VITE_CAJO_ADDRESS` | Point the UI at a different deployment, e.g. a local Hardhat node. |

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run typecheck` | Strict type-check of app and tooling |
| `npm run lint` | ESLint |
| `npm run sync-abi` | Copy the ABI from the Hardhat build (`npx hardhat compile` in the repo root first) |

## What works

**Landing page (`/`)**: hero with a live summary (group count and current fee read from the contract), key facts,
how it works, an interactive collateral illustration, safety rules, and an FAQ. Nav links scroll to each section
and track the one in view.

**Dashboard (`/app`)**, no wallet needed:

- Summary: group count, current fee, RPC network status, last-updated time. Refreshes every 15 seconds.
- Latest 20 groups, newest first, filterable by state, plus a "go to group ID" lookup.
- Group detail: round progress, a timeline with a live countdown to the round deadline and default cutoff,
  every payout slot with its holder, payment status and deposit, the token and the creator.
- **My position** (wallet connected): member state, slot, rounds paid, escrow, payout received, withdrawable.

**Wallet**: MetaMask connect, wrong-network detection with a one-click switch to BSC Testnet (adds the network if
the wallet doesn't know it), and clear messages for "no wallet", "request rejected" and "request already open".

**States handled**: loading skeletons, empty contract, unknown group ID, RPC failure with retry, stale data after
a failed refresh, wallet on the wrong network.

**Responsive** from 320px to 2560px with no horizontal scroll. The layout is mobile-first: phones get a full-screen
menu and group sheet, desktop gets a master/detail view. The app is keyboard accessible and respects
`prefers-reduced-motion`.

## How it reads the chain

- All reads go through a `JsonRpcProvider` to BSC Testnet, so a wallet is optional.
- At most 5 RPC calls run at once. Polling pauses while the tab is hidden, and stale requests are cancelled.
- Amounts stay `bigint` end to end and are formatted with each group's own token `decimals()`. The app never
  assumes USDT or 18 decimals.
- A missing group returns zeros instead of reverting, so existence is checked against `groupCount` and a non-zero
  creator.
- Countdowns run on the latest block's timestamp, the same clock the contract uses.
- Tokens outside a small allowlist in `config.ts` get an "Unlisted token" badge.

## Check it against BscScan

Open the contract's [Read Contract tab](https://testnet.bscscan.com/address/0xc9d30A50579Fbd7aEDb48a4E7F02Eab56C3298b4#readContract)
next to `/app` and compare `groupCount`, `feeBps` (100 = 1%) and `groups(id)` for any group. Token amounts on
BscScan are raw base units; divide by `10^decimals`.

## Project structure

```
src/
  config.ts             addresses, chain, RPC, explorer, token allowlist
  abi.ts, abi/Cajo.json compiled contract ABI
  useWallet.ts          wallet state (connect, switch network, listeners)
  lib/cajo.ts           every contract read, typed and validated
  lib/                  formatting, concurrency limiter, collateral maths, wallet errors, scrolling
  hooks/                polling, scroll-spy, modal focus trap, media queries
  pages/landing/        landing sections
  pages/dashboard/      summary, group list, detail, timeline, slots, my position
  styles/               tokens, base, layout, landing, dashboard
```

## What's next

- Write flows: approve and join a slot, contribute, trigger a payout, remove a defaulter, withdraw, reclaim a deposit.
- Group history from contract events (payouts, defaults, short payouts).
- Batch reads with Multicall to cut RPC calls on large groups.
- Unit tests for formatting, the limiter and the collateral maths.
- Hosted deployment and testing on real phones and tablets.
