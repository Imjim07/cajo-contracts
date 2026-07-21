# CAjo — Architecture & Design Decisions

> The "why" behind every choice. If a decision isn't recorded here, it isn't locked.
> Audience: future contributors, auditors, investors, and future-us at 2am.

## 1. What CAjo is

A trustless rotating savings group (Ajo / Esusu / ROSCA) on BNB Smart Chain.
A fixed set of members contributes a fixed amount of USDT every round; each round,
one member collects the entire pot. The smart contract replaces the traditional
alajo (collector): it holds all funds, enforces the payout order, and punishes
defaults automatically. CAjo (the company) never custodies user money.

## 2. Core design decisions

### D1 — Chain: BNB Smart Chain. Token: USDT (BEP-20, 18 decimals)
Low fees suit small recurring contributions; USDT is the de-facto dollar of
African crypto users. USDT on BSC uses 18 decimals (not Ethereum's 6) — tests
and frontend math must use 18.

### D2 — Non-custodial, always
The contract holds funds; the company holds nothing. This is the legal shield —
the line between "software company" and "unlicensed financial institution."
Any feature requiring CAjo to hold user funds is rejected on principle. Fiat
(naira) enters only via licensed on-ramp partners at the frontend (see D8).

### D3 — Reverse-risk slot deposits (public mode)
The member who collects FIRST has the most incentive to vanish (holds everyone's
money, still owes the most rounds). Sliding/installment escrow under-collateralizes
early positions (the "early-payout attack"). Solution: each payout position is a
slot with an upfront deposit equal to what that member will still owe after
collecting:
    deposit(position) = contributionAmount × (memberTarget − position)
Position 1 locks the most; the last position locks 0. Refunded at completion,
seized on default. Bonus: patient savers get a near-zero-deposit experience.

### D4 — Presets, not knobs
Creators choose a MODE, never individual safety parameters. Configurable safety
is not safety. v1 ships PUBLIC mode only. FRIENDS mode (light escrow, invite +
per-member creator approval, low caps, explicit risk acknowledgment, not
discoverable in-app) is designed but disabled; the EscrowMode enum exists in
storage now because deployed contracts are immutable.

### D5 — Defaults are cause-blind and time-based
Default = deadline + grace passed AND member hasn't paid the current round. The
contract never asks why (death, lost keys, bad faith are identical). Anyone may
call kickDefaulter — no admin.

### D6 — Seized deposits DRIP into the pot
A defaulter's seized deposit feeds a per-group dripReserve, released evenly over
remaining rounds so pots stay full-sized. (Rejected: immediate pro-rata payout —
it shrinks future pots and punishes patient members.)

### D7 — Cycle shortens only on pre-collection default
Pre-collection default: the defaulter's payout round is removed (gap close;
everyone behind shifts up; memberTarget shrinks). Post-collection default: cycle
length unchanged, drip covers their missing shares.
AMENDMENT (fairness): the group in aggregate loses nothing — the defaulter's
forfeiture funds all survivor outcomes. But the benefit skews toward members who
collected BEFORE the default (their windfall is already disbursed and
unrecoverable). Seized deposits drip into remaining pots to partially rebalance
toward later collectors. The residual asymmetry is accepted and DISCLOSED to
users. Default forfeits everything — deposit and prior contributions — with no
exceptions, because any refund carve-out is a griefing vector.

### D8 — Naira via licensed partners only
Users fund with naira through SEC-licensed Nigerian on-ramps (converted to USDT
before touching the contract). The contract is fiat-blind. Nigerian regulation
(ISA 2025, VASP licensing, crypto taxation from Jan 2026) requires a fintech-
lawyer review before mainnet launch to Nigerian users. A launch gate, not a
suggestion. Price-locking currencies is REJECTED (see D9) — it is an FX
derivative, not a savings feature; USDT already provides dollar stability.

### D9 — Deliberate v1 exclusions (roadmap, not scope)
- Friends mode (v2): approval-gated traditional groups.
- Beneficiary system (v2): contributeFor() + payout redirection so a family can
  keep a deceased member's slot alive. The naive "beneficiary address only"
  version protects nobody and isn't worth shipping.
- Prepayment / scheduled auto-debit (v2): useful for travelers, but requires
  either custody (voids D2) or a keeper with fund permissions (voids D10), plus
  a refund path for prepaid rounds in cancelled groups. Trustless version uses
  token approvals; deferred until the core is proven.
- Price-locked / multi-currency pots, personal savings accounts: different
  companies, different licenses. Vision, not v1.

### D10 — Time is the only authority
No admin keys exist anywhere in the protocol. Every enforcement action
(kickDefaulter, cancelIfUnfilled) is permissionless and gated by deadlines
alone — actions that can only help members need conditions, not gatekeepers,
and any CAjo power over funds would void D2. Groups get a fill deadline at
creation; before it nobody (creator or CAjo) can cancel, and after it anyone
can cancel an unfilled group, which only unlocks each member's own deposit for
reclaim. Joining is blocked past the deadline (no surprise activation).
Unclaimed balances remain claimable FOREVER; nothing ever escheats to the
platform. (A platform that can confiscate or expire user funds is, by
definition, the rug-pull risk users fear — CAjo is architecturally incapable
of it.)

### D11 — The platform fee cannot become a weapon
Fee is set once at deployment and is immutable — no function can change it.
Hard-capped at 3% by a compile-time constant: a higher-fee Cajo cannot be
constructed. Charged on payouts only — never deposits or refunds. Each group
locks its fee at creation, so running groups are never affected by a later
version. The treasury collects via the same pull-pattern withdraw() as members;
no privileged transfer path. Changing the fee means deploying a new public
contract; existing groups are untouchable. Launch fee: 1% (vs. 2–5% for a Lagos
alajo).

## 3. Contract map

    Cajo.sol
    ├─ constructor(treasury, feeBps)     — feeBps immutable, capped at MAX_FEE_BPS (300)
    ├─ createGroup(...)                  — creator claims a slot + pays its deposit
    ├─ joinGroup(groupId, position)      — pay slot deposit, claim position
    ├─ contribute(groupId)               — pay this round's contribution
    ├─ triggerPayout(groupId)            — credit pot (minus fee, plus drip) to slot holder
    ├─ kickDefaulter(groupId, member)    — time-based; gap-close or drip
    ├─ cancelIfUnfilled(groupId)         — permissionless after fill deadline
    ├─ claimEscrowRefund(groupId)        — after Completed OR Cancelled; credits withdrawable
    ├─ withdraw(groupId)                 — the ONLY token-out door; pays msg.sender only
    └─ views: slotDeposit, openSlots, getGroupStatus

Security primitives: OpenZeppelin SafeERC20 (USDT's non-standard returns),
ReentrancyGuard on every state-changing function, custom errors, strict
checks-effects-interactions ordering, pull-over-push for all outgoing value.

## 4. Invariants (tested)

1. contract token balance == Σ(deposits) + Σ(pots) + dripReserve + Σ(withdrawable credits)
2. a slot maps to at most one member; a member holds at most one slot per group
3. no member contributes twice in one round
4. only EscrowMode.Public groups can be created (v1)
5. every completed or cancelled lifecycle ends with the contract holding exactly 0
6. platform fee never exceeds MAX_FEE_BPS and is charged only at payout

## 5. Build log

- 2026-07-12 — Contract skeleton; createGroup/joinGroup/contribute; reverse-risk
  slot deposits (closes early-payout attack); EscrowMode reserved; Hardhat +
  19-test suite; compiles on solc 0.8.24; repo pushed.
- 2026-07-21 — triggerPayout + withdraw (pull pattern); claimEscrowRefund.
- 2026-07-21 — kickDefaulter with gap-close + unified drip reserve; viaIR enabled.
- 2026-07-21 — Fill deadline + permissionless cancelIfUnfilled; stuck-funds gap closed.
- 2026-07-21 — Immutable capped platform fee (1%, cap 3%), payout-only,
  pull-pattern treasury. Core v1 feature-complete. 43 tests green.
