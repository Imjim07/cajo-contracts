# Notes: scope decision and bugs fixed

## Scope decision

**This first slice is read-only.** It covers wallet connection, a BSC Testnet network guard, and a dashboard of
live group and round data. It has no write transactions.

Why:

- **Correct data comes first.** Every later feature (joining, contributing, paying out) depends on reading
  groups, slots and deadlines correctly, and the contract has traps that are easy to get wrong (below). Getting
  reads right first means write flows can build on a tested data layer.
- **Writes carry real risk.** Joining needs a token approval, then a call that locks a deposit. Shipping that
  before the read side was proven would mean asking users to sign transactions against a UI that might show the
  wrong numbers.
- **It fits the time box.** A polished, fully handled read slice beats a half-working write flow.

**What the dashboard shows, and why.** I listed the contract's read functions first, then picked the ones a member
or reviewer needs:

| Read | Used for |
|---|---|
| `groupCount()` | how many groups exist; which IDs are valid |
| `feeBps()` | current fee (capped at 3% in code) |
| `groups(id)` | everything about a group in one call (state, round, members, pot, timings) |
| `openSlots(id)` | which payout positions are taken |
| `payoutOrder(id, position)` | who holds each slot |
| `slotDeposit(id, position)` | the deposit each slot requires |
| `members(id, address)` | each holder's state and payments, and "My position" |
| `withdrawable(id, address)` | what the connected wallet can withdraw |
| `symbol()` / `decimals()` on the group's token | formatting amounts correctly |

`getGroupStatus(id)` is a subset of `groups(id)`, so the app reads `groups(id)` once instead of both. Its
`roundDeadline` also excludes the grace period, so the default cutoff is computed from `groups(id)` anyway.

**Contract traps the data layer handles:**

- A missing group returns all zeros instead of reverting, and state `0` reads as "Open". The app checks the ID
  against `groupCount` and that the creator is non-zero.
- Positions are 1-indexed but `openSlots` is 0-indexed.
- `memberCount` counts *active* members, and `memberTarget` shrinks after a default. The app labels it
  "active members".
- After a default, `slotDeposit` reflects the smaller group, so it can differ from what a holder actually locked.
  The slot grid shows the holder's real escrow next to it.
- Any ERC-20 can back a group, so decimals are read per token, never assumed.

**Verification.** The live testnet contract had no groups during development, so I also ran a local Hardhat chain
posing as chain 97, seeded with an Open, an Active, a defaulted, a Completed and a Cancelled group. The app was
checked against both, in headless Chrome at widths from 320 to 2560px.

## Scope update: joining a slot

After the read-only slice was done, I added one write flow, joining an open slot, so a demo can show a member
entering a group from the UI instead of BscScan. Everything else (contribute, payouts, defaults, withdrawals) is
still out of scope.

Safety rules for the only two transactions the app sends:

- **Exact approvals.** The app approves exactly the slot's deposit, never an unlimited amount, and skips the
  approval when the deposit is 0.
- **Re-check before signing.** The dialog re-reads the slot holder, the wallet's membership, its balance and
  allowance, and the latest block time, and blocks with a reason instead of letting a doomed transaction through.
- **Simulate before sending.** Each transaction runs as a `staticCall` first. A revert is decoded against the
  contract's custom errors and OpenZeppelin's token errors, and shown as a sentence. MetaMask never opens for a
  transaction that would fail.
- **Unreadable tokens block joining.** A group whose "token" doesn't answer `decimals()` can't be joined. This
  happened for real: testnet group #1 was created with a wallet address in the token field, so its deposits could
  never transfer.

Verified end to end on a local chain with real transactions: approve then join (allowance back to exactly 0
afterwards), already a member, no balance, fill deadline passed, unreadable token, a rejected approval, and a race
where the group filled between approval and join (stopped by simulation, so no join transaction was sent).

## Bugs fixed

### 1. Countdowns used the device clock; the contract uses block time

- **Symptom:** On a chain whose clock had moved ahead, a round whose deadline had already passed still showed
  "Round deadline in 23h".
- **Cause:** The countdown compared deadlines to `Date.now()`. The contract judges every deadline by
  `block.timestamp`, so a device clock that's off (or a stalled chain) shows the wrong phase.
- **Fix:** Each refresh reads the latest block's timestamp and applies the offset to the countdown.
- **Found by:** fast-forwarding time on the local test chain.

### 2. A wallet with a mixed-case address looked disconnected

- **Symptom:** After a reload, an already-connected wallet showed "Connect wallet".
- **Cause:** ethers' `getAddress()` throws on a mixed-case address with an invalid checksum. The silent session
  restore swallowed that error, and a throw inside the `accountsChanged` listener could break the UI.
- **Fix:** Lowercase before checksumming.

### 3. The mobile menu would be trapped inside the navbar

- **Cause:** The navbar uses `backdrop-filter` once the page scrolls, and that makes it the containing block for
  `position: fixed` children. The full-screen menu would have been squeezed into the navbar.
- **Fix:** Render the menu through a React portal on `document.body`.

### 4. The slot cache could keep incomplete data

- **Cause:** Slot data is cached until a group changes. An aborted request or one failed `slotDeposit` read could
  be cached and shown as "Unavailable" until the group next changed.
- **Fix:** Cache only complete, non-aborted reads.

### 5. Clicking a nav link at the top of the page lost the URL hash

- **Cause:** Scroll-spy clears the hash when the page is at the top. On a nav click the smooth scroll starts at
  the top, so the first scroll event wiped the hash the click had just set.
- **Fix:** Clear the hash only after scrolling settles at the top.

### 6. Escape closed two modals at once

- **Cause:** On phones the join dialog opens on top of the group sheet. Both listened for Escape and Tab, so one
  Escape closed both.
- **Fix:** Open modals form a stack, and only the top one handles keys.

### 7. Layout bugs caught by width checks

- A 24px horizontal scroll at exactly 768px, where the full nav didn't fit.
- Tablet connector lines in the hero visual pointed at empty space because of a CSS specificity conflict.

### BigInt formatting

There was no bug here, by design: every on-chain integer stays a `bigint`. Amounts are formatted as strings with
the token's own decimals, truncated rather than rounded, so precision is never lost to floating point. Small
counters (`uint8`/`uint16`) and timestamps are converted to `number` explicitly at the boundary.
