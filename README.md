# CÀjọ

**A trustless rotating savings protocol (Ajo / Esusu / ROSCA) on BNB Smart Chain.**

CÀjọ puts the traditional West African savings circle on-chain. A fixed group of
members contributes a set amount of USDT each round; every round, one member
collects the whole pot, rotating until everyone has collected once. The smart
contract replaces the human collector (*alajo*): it holds all funds, enforces the
payout order, and handles defaults automatically — with no admin, no custody, and
no one who can freeze or seize members' money by decree.

---

## ⚠️ Project status

**Feature-complete and self-audited — NOT yet deployed or independently audited.**

This is an actively developed portfolio and learning project. The core protocol is
implemented and covered by a comprehensive test suite (54 passing tests, including
adversarial/attack scenarios). It has **not** undergone a professional third-party
security audit and is **not** deployed to any mainnet. **Do not use it with real
funds.** A professional audit and legal review are prerequisites before any mainnet
launch.

---

## Why it's interesting

- **Non-custodial by design.** The contract holds funds; the operator holds nothing
  and has no key that can move user money. This is a deliberate architectural
  choice, not an afterthought — it's what separates a savings tool from a
  custodial risk.
- **Reverse-risk collateral.** The member who collects earliest (and therefore has
  the most incentive to walk away) must lock the largest security deposit; the last
  collector locks none. Risk and collateral mirror each other exactly, closing the
  classic ROSCA "early-payout" failure mode.
- **No admin, no gatekeepers.** Every enforcement action — kicking a defaulter,
  cancelling a group that never filled — is permissionless and gated purely by
  time. Unclaimed funds remain claimable forever; nothing ever escheats to the
  platform.
- **Fee that can't become a weapon.** The platform fee is immutable, hard-capped in
  the bytecode itself (a higher-fee contract literally cannot be constructed), and
  charged only on payouts.

## Engineering highlights

- **Adversarial testing.** The suite doesn't just prove the happy path — it proves
  the contract *rejects* attacks: double-joining, double-contributing, claiming
  taken slots, kicking members early, draining via double-triggered payouts, and
  more.
- **Self-audit.** A structured self-audit uncovered a fund-freezing bug (a round
  could become permanently unpayable if a member stopped contributing). It was
  fixed in three separately-tested stages and is now covered by end-to-end
  scenarios including the honest worst case.
- **Documented decisions.** Every non-obvious design choice — and every rejected
  alternative — is recorded with its reasoning in
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Fifteen decisions, three
  amendments, eight tested invariants.
- **Money-conservation invariant.** Every full lifecycle test asserts the contract
  ends holding exactly zero — no dust, no stranded funds.

## Tech stack

Solidity `0.8.24` · Hardhat · TypeScript tests · OpenZeppelin (SafeERC20,
ReentrancyGuard) · viaIR compilation · BNB Smart Chain (USDT BEP-20).

## Running it locally

Requires Node.js (LTS) and npm.

```bash
git clone https://github.com/Imjim07/cajo-contracts.git
cd cajo-contracts
npm install
npx hardhat test
```

You should see all tests pass. The test suite is the best documentation of how the
protocol behaves — start there.

## Architecture

The full design rationale lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
In brief: a single `Cajo.sol` contract manages group lifecycles (create → join →
contribute → payout → complete), with all outgoing value flowing through one
audited pull-pattern `withdraw()` function. Defaults are handled by seizing a
defaulter's deposit and using it first to repair anyone who received a short
payout, then distributing the remainder.

## Roadmap

- Third-party security audit and legal review (pre-maincondition for mainnet)
- BSC testnet deployment
- Frontend dApp (React + TypeScript, wallet integration)
- Friends mode (lighter-collateral groups for members who know each other)
- Fiat on-ramp via licensed partners

## License

MIT

---

*Built by Yeh(https://github.com/Imjim07) as a study in trustless financial
protocol design.*