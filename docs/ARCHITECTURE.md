# CÀjọ — Architecture & Design Decisions

> The "why" behind every choice. If a decision isn't recorded here, it isn't locked.
> Audience: future contributors, auditors, investors, and future-us at 2am.

## 1. What CÀjọ is

A trustless rotating savings group (Ajo / Esusu / ROSCA) on BNB Smart Chain.
A fixed set of members contributes a fixed amount of USDT every round; each
round one member collects the whole pot. The smart contract replaces the
traditional alajo (collector): it holds all funds, enforces payout order, and
punishes defaults automatically. CÀjọ (the company) never custodies user money.

## 2. Core design decisions

### D1 — Chain: BNB Smart Chain. Token: USDT (BEP-20, 18 decimals)
Low fees suit small recurring contributions; USDT is the de-facto dollar of
African crypto users. USDT on BSC uses 18 decimals (not Ethereum's 6) — tests
and frontend math must use 18.

### D2 — Non-custodial, always
The contract holds funds; the company holds nothing. This is the legal shield —
the line between "software company" and "unlicensed financial institution."
Any feature requiring CÀjọ to hold user funds is rejected on principle. Fiat
(naira) enters only via licensed on-ramp partners at the frontend (D8).

### D3 — Reverse-risk slot deposits (public mode)
The member who collects FIRST has the most incentive to vanish (holds everyone's
money, still owes the most rounds). Installment escrow under-collateralizes early
positions. Solution: each payout position is a slot with an upfront deposit equal
to what that member will still owe after collecting:
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

**AMENDMENT 1 (fairness):** the group in aggregate loses nothing — the
defaulter's forfeiture funds all survivor outcomes. But the benefit skews toward
members who collected BEFORE the default (their windfall is already disbursed and
unrecoverable). Seized deposits drip into remaining pots to partially rebalance
toward later collectors. The residual asymmetry is accepted and DISCLOSED to
users. Default forfeits everything — deposit and prior contributions — with no
exceptions, because any refund carve-out is a griefing vector.

**AMENDMENT 2 (Option A + deposit-funded repair):** the old rule "payout waits
until every member has paid this round" could never be satisfied if a member
stopped showing up — freezing funds and breaking D10. New rule (Option A): after
the round deadline + grace passes, triggerPayout fires with whatever was
collected (a short pot rather than a frozen group). The contract records which
round was short and who received the short pot. When the causing defaulter is
later kicked, their seized deposit FIRST tops the shorted collector back up to a
full pot (credited to their withdrawable balance — pull pattern, so it works even
if they already withdrew the short pot); only the remainder drips onward.
Confirmed sub-decisions: a defaulter never collects a pot; the grace period
already protects honest-but-late payers; a short payout fires no matter how small
(Choice A — always pay).

**AMENDMENT 3 (multi-default repair order):** when multiple shortfalls exist and
seized deposits can't make everyone whole, repair in ROUND ORDER (earliest first),
each shortfall filled fully before the next, stopping when seized runs out;
remainder drips. In a multi-default collapse the math may NOT make everyone whole
— ACCEPTED and DISCLOSED. The contract's job is to distribute the wreckage fairly
and NEVER FREEZE, not to conjure money that has left the building.

### D8 — Naira via licensed partners only
Users fund with naira through SEC-licensed Nigerian on-ramps (converted to USDT
before touching the contract). The contract is fiat-blind. Nigerian regulation
(ISA 2025, VASP licensing, crypto taxation from Jan 2026) requires a fintech-
lawyer review before mainnet launch to Nigerian users — a launch gate, not a
suggestion. Price-locking currencies is REJECTED: it is an FX derivative, not a
savings feature; USDT already provides dollar stability.

### D9 — Deliberate v1 exclusions (roadmap, not scope)
- Friends mode (v2): approval-gated traditional groups.
- Beneficiary system (v2): keep a deceased member's slot alive. The naive
  "beneficiary address only" version protects nobody and isn't worth shipping.
- Prepayment / scheduled auto-debit (v2): useful for travelers, but requires
  either custody (voids D2) or a keeper with fund permissions (voids D10), plus a
  refund path for prepaid rounds in cancelled groups. Trustless version uses token
  approvals; deferred until the core is proven.
- Price-locked / multi-currency pots, personal savings accounts: different
  companies, different licenses. Vision, not v1.

### D10 — Time is the only authority
No admin keys exist anywhere in the protocol. Every enforcement action
(kickDefaulter, cancelIfUnfilled) is permissionless and gated by deadlines alone.
Groups get a fill deadline at creation; before it nobody (creator or CÀjọ) can
cancel, and after it anyone can cancel an unfilled group, which only unlocks each
member's own deposit for reclaim. Joining is blocked past the deadline (no
surprise activation). Unclaimed balances remain claimable FOREVER; nothing ever
escheats to the platform. A platform that can confiscate or expire user funds is,
by definition, the rug-pull risk users fear — CÀjọ is architecturally incapable
of it.

### D11 — The platform fee cannot become a weapon
Fee is set once at deployment and is immutable — no function can change it.
Hard-capped at 3% by a compile-time constant: a higher-fee CÀjọ cannot be
constructed. Charged on payouts only — never deposits or refunds. Each group
locks its fee at creation, so running groups are never affected by a later
version. The treasury collects via the same pull-pattern withdraw() as members;
no privileged transfer path. Changing the fee means deploying a new public
contract; existing groups are untouchable. Launch fee: 1% (vs. 2–5% for a Lagos
alajo).

### D12 — Seized funds are handled by code alone, never by discretion
A defaulter's seized deposit is distributed BY FORMULA: it first repairs any
shorted collector (D7 Amendment 2), then drips into remaining pots. It flows
SIDEWAYS to the wronged members — never up to CÀjọ, never back to the defaulter.
REJECTED: support-ticket reclaim of seized funds. Any human deciding whether to
return seized money makes CÀjọ a custodian and adjudicator — the exact custody
role D2 forbids, requiring licenses, inviting fraud (unverifiable sob-story
tickets), and breaking trustlessness. Seizure is final because "final" is the
only thing strangers can trust. Mercy belongs in the RULES (grace periods, round
settings, Friends-mode leniency) BEFORE seizure — never in enforcement AFTER it.

### D13 — Unstable-income accommodation (rules-level, not enforcement-level)
CÀjọ will document guidance and/or a preset for groups serving members with
irregular income: longer grace periods and round durations chosen at creation.
Mercy expressed in the RULES a group opts into up front — NOT a discretionary
exception to seizure. The code still enforces strictly once a deadline+grace
passes; the leniency is that the group chose gentle deadlines to begin with.
(v1 = guidance; a formal preset is a v2 consideration.)

### D14 — Forgiveness mechanics deferred to v2
The honest-but-broke member (paid earlier rounds, misses one, loses forfeited
contributions + deposit) is a real tension. A "one free miss" / late-top-up /
group-vote-to-forgive mechanic is v2, not v1, because it adds attack surface
(abuse of the free miss, who funds the forgiven round's gap). Priority: fix
CORRECTNESS (the freeze bug) before adding KINDNESS.

### D15 — Zero-deposit / multi-identity attacks are an identity-layer problem
The last slot correctly locks ZERO deposit (nothing to insure). Forcing a deposit
there is rejected: it charges insurance on a non-existent risk and punishes the
fairest position. A pre-collection zero-deposit defaulter still forfeits their
PAID contributions (already in prior pots), so the group stays whole. The
Sybil/two-account attack (one person takes slot 5 + a real slot for a free
disruption lever) is a FRONTEND/IDENTITY problem (KYC, wallet-identity binding),
unsolvable in Solidity on a permissionless chain. Flagged for launch-phase, NOT
patched in the contract.

## 3. Contract map

    Cajo.sol
    ├─ constructor(treasury, feeBps)     — feeBps immutable, capped at MAX_FEE_BPS (300)
    ├─ createGroup(...)                  — creator claims a slot + pays its deposit
    ├─ joinGroup(groupId, position)      — pay slot deposit, claim position
    ├─ contribute(groupId)               — pay this round's contribution
    ├─ triggerPayout(groupId)            — full pot OR short pot after deadline; records shortfall
    ├─ kickDefaulter(groupId, member)    — time-based; repairs shorted collectors first, then gap-close/drip
    ├─ cancelIfUnfilled(groupId)         — permissionless after fill deadline
    ├─ claimEscrowRefund(groupId)        — after Completed OR Cancelled; credits withdrawable
    ├─ withdraw(groupId)                 — the ONLY token-out door; pays msg.sender only
    └─ views: slotDeposit, openSlots, getGroupStatus, roundShortfall, shortedCollector

Security primitives: OpenZeppelin SafeERC20, ReentrancyGuard on every
state-changing function, custom errors, strict checks-effects-interactions
ordering, pull-over-push for all outgoing value. Compiled with viaIR.

## 4. Invariants (tested)

1. contract token balance == Σ(deposits) + Σ(pots) + dripReserve + Σ(withdrawable credits)
2. a slot maps to at most one member; a member holds at most one slot per group
3. no member contributes twice in one round
4. only EscrowMode.Public groups can be created (v1)
5. every completed or cancelled lifecycle ends with the contract holding exactly 0
6. platform fee never exceeds MAX_FEE_BPS and is charged only at payout
7. a round never freezes: after deadline+grace it pays out whatever was collected
8. a shorted collector is repaired first from seized deposits, in round order

## 5. Build log

- Contract skeleton; createGroup/joinGroup/contribute; reverse-risk slot deposits
  (closes early-payout attack); EscrowMode reserved; Hardhat + 19-test suite.
- triggerPayout + withdraw (pull pattern); claimEscrowRefund.
- kickDefaulter with gap-close + unified drip reserve; viaIR enabled.
- Fill deadline + permissionless cancelIfUnfilled; stuck-funds gap closed.
- Immutable capped platform fee (1%, cap 3%), payout-only, pull-pattern treasury.
- Dev environment migrated to Dell OptiPlex (clone + install + green).
- Self-audit found a group-freeze bug. Fixed in 3 tested steps: (1) short payout
  records shortfall; (2) seized deposit repairs shorted collector first; (3) messy
  end-to-end scenarios (short-then-complete, never-repaired worst case). 54 tests green.