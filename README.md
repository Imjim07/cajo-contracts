# CAjo Contracts - v1

Trustless rotating savings (Ajo/ROSCA) on BNB Smart Chain. USDT BEP-20, non-custodial,
reverse-risk slot deposits (public mode only in v1).

## Setup (local)
```bash
npm install
npx hardhat compile
npx hardhat test
```

## Layout
- `contracts/Cajo.sol` - main contract. createGroup/joinGroup/contribute implemented;
  triggerPayout/kickDefaulter/claimEscrowRefund are specified stubs (next milestone).
- `contracts/MockUSDT.sol` - test-only token (18 decimals, matching BSC USDT).
- `test/Cajo.test.ts` - 18 tests incl. attack scenarios. All must pass before any new code.

## Locked design decisions
1. Reverse-risk slot deposits: deposit(position) = contribution x (members - position),
   paid upfront at join, refunded at completion, seized on default.
2. Seized deposits DRIP into the pot round by round (pots never shrink).
3. Cycle shortens only when a pre-collection member defaults (their payout round is removed;
   group loses nothing, defaulter forfeits everything).
4. EscrowMode enum present now; Friends mode rejected until v2.
5. Fiat (naira) enters via licensed on-ramp partners at the frontend layer only.
   The contract never touches fiat. Legal review required before mainnet with NG users.

## Deploy (testnet, later)
BSC testnet config is in hardhat.config.ts - set DEPLOYER_KEY env var. Never commit keys.
