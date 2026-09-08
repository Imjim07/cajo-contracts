// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * CAjo - Trustless rotating savings (Ajo/ROSCA) on BSC
 * Token: USDT BEP-20
 *
 * v1 scope: PUBLIC MODE ONLY, non-custodial.
 * Escrow model (public mode): REVERSE-RISK SLOT DEPOSITS.
 *   Each payout position is a slot with a fixed upfront deposit:
 *   deposit(position) = contributionAmount * (memberTarget - position)
 *   i.e. exactly what that member will still owe the group after
 *   they collect. Position 1 locks the most; last position locks 0.
 *   Deposits are refunded in full at cycle completion, seized on default.
 *
 * EscrowMode enum exists NOW for immutability reasons; Friends mode
 * logic ships in a later version. Public is the only accepted value in v1.
 *
 * Install: npm i @openzeppelin/contracts
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Cajo is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Platform fee - immutable by design (see docs: D11)
    // ------------------------------------------------------------------

    uint16 public constant MAX_FEE_BPS = 300; // 3% - a higher-fee Cajo cannot be constructed
    uint16 public immutable feeBps;           // set once at deployment, e.g. 100 = 1%
    address public immutable treasury;        // collects fees via the same pull pattern as everyone

    error BadConstruction();

    constructor(address _treasury, uint16 _feeBps) {
        if (_treasury == address(0) || _feeBps > MAX_FEE_BPS) revert BadConstruction();
        treasury = _treasury;
        feeBps = _feeBps;
    }

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum GroupState { Open, Active, Completed, Cancelled }
    enum MemberState { None, Active, Defaulted, Exited }
    enum EscrowMode { Public, Friends } // Friends reserved, rejected in v1

    struct Member {
        MemberState state;
        uint16 payoutPosition;   // 1-indexed slot in payout order
        uint16 roundsPaid;       // rounds this member has contributed for
        uint256 escrowBalance;   // upfront slot deposit held
        bool payoutReceived;
    }

    struct Group {
        address creator;
        IERC20 token;               // USDT BEP-20
        uint256 contributionAmount; // per member per round (token decimals)
        uint16 memberTarget;        // total slots = total rounds
        uint16 memberCount;         // joined so far
        uint16 currentRound;        // 1-indexed once Active
        uint64 roundDuration;       // seconds per round
        uint64 gracePeriod;         // seconds after deadline before default
        uint64 roundStart;          // timestamp current round opened
        uint64 fillDeadline;        // Open groups must fill by this time or become cancellable
        GroupState state;
        EscrowMode escrowMode;
        uint256 potBalance;         // contributions awaiting payout this round
        uint256 dripReserve;        // seized deposits, released evenly into remaining pots
        uint16 feeBps;              // copied from the platform at creation; immutable for this group's life
        uint16 contributionsThisRound;
    }

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    uint256 public groupCount;
    mapping(uint256 => Group) public groups;
    mapping(uint256 => mapping(address => Member)) public members;
    mapping(uint256 => mapping(uint16 => address)) public payoutOrder; // groupId => position => member
    mapping(uint256 => mapping(address => uint256)) public withdrawable; // groupId => user => claimable tokens (pull pattern)
    // Step-1 shortfall ledger: how much a given round's payout was short,
    // and who received the short pot (whom a later kick must repair first).
    mapping(uint256 => mapping(uint16 => uint256)) public roundShortfall; // groupId => round => amount short
    mapping(uint256 => mapping(uint16 => address)) public shortedCollector; // groupId => round => recipient owed repair

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event GroupCreated(uint256 indexed groupId, address indexed creator, uint256 contributionAmount, uint16 memberTarget);
    event SlotClaimed(uint256 indexed groupId, address indexed member, uint16 position, uint256 deposit);
    event GroupActivated(uint256 indexed groupId, uint64 roundStart);
    event Contributed(uint256 indexed groupId, address indexed member, uint16 round, uint256 amount);
    event PayoutTriggered(uint256 indexed groupId, uint16 round, address indexed recipient, uint256 amount);
    event MemberDefaulted(uint256 indexed groupId, address indexed member, uint16 round, uint256 escrowSeized);
    event EscrowRefunded(uint256 indexed groupId, address indexed member, uint256 amount);
    event Withdrawn(uint256 indexed groupId, address indexed member, uint256 amount);
    event GroupCancelled(uint256 indexed groupId);
    event FeeAccrued(uint256 indexed groupId, uint16 round, uint256 amount);
    event ShortPayout(uint256 indexed groupId, uint16 round, address indexed recipient, uint256 paid, uint256 shortBy);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error InvalidParams();
    error WrongState();
    error NotMember();
    error AlreadyPaidThisRound();
    error SlotTaken();
    error InvalidSlot();
    error AlreadyJoined();
    error RoundNotOver();
    error GraceNotExpired();
    error NothingToRefund();
    error ModeNotSupported();
    error RoundIncomplete();
    error NothingToWithdraw();
    error NotCompleted();
    error NotDefaultable();
    error FillDeadlinePassed();
    error FillDeadlineNotPassed();

    // ------------------------------------------------------------------
    // createGroup
    // ------------------------------------------------------------------

    function createGroup(
        IERC20 token,
        uint256 contributionAmount,
        uint16 memberTarget,
        uint64 roundDuration,
        uint64 gracePeriod,
        uint64 fillWindow,
        EscrowMode mode,
        uint16 creatorSlot
    ) external returns (uint256 groupId) {
        if (mode != EscrowMode.Public) revert ModeNotSupported(); // v1 gate
        if (
            address(token) == address(0) ||
            contributionAmount == 0 ||
            memberTarget < 2 ||
            memberTarget > 50 ||
            roundDuration < 1 days ||
            gracePeriod < 6 hours ||
            fillWindow < 1 hours ||
            fillWindow > 365 days
        ) revert InvalidParams();

        groupId = ++groupCount;
        Group storage g = groups[groupId];

        g.creator = msg.sender;
        g.token = token;
        g.contributionAmount = contributionAmount;
        g.memberTarget = memberTarget;
        g.roundDuration = roundDuration;
        g.gracePeriod = gracePeriod;
        g.state = GroupState.Open;
        g.escrowMode = mode;
        g.fillDeadline = uint64(block.timestamp) + fillWindow;
        g.feeBps = feeBps;

        emit GroupCreated(groupId, msg.sender, contributionAmount, memberTarget);

        // Creator claims a slot like everyone else - no free rides
        _claimSlot(groupId, msg.sender, creatorSlot);
    }

    // ------------------------------------------------------------------
    // slotDeposit - the reverse-risk price of each position
    // ------------------------------------------------------------------

    /**
     * Position 1 collects first and owes (memberTarget - 1) more rounds
     * after collecting, so it locks exactly that amount. The last position
     * owes nothing after collecting and locks 0.
     */
    function slotDeposit(uint256 groupId, uint16 position) public view returns (uint256) {
        Group storage g = groups[groupId];
        if (position == 0 || position > g.memberTarget) revert InvalidSlot();
        return g.contributionAmount * (g.memberTarget - position);
    }

    // ------------------------------------------------------------------
    // joinGroup - claim a payout slot by paying its deposit
    // ------------------------------------------------------------------

    /**
     * Frontend: token.approve(cajo, slotDeposit(groupId, position))
     * then cajo.joinGroup(groupId, position).
     */
    function joinGroup(uint256 groupId, uint16 position) external nonReentrant {
        _claimSlot(groupId, msg.sender, position);
    }

    function _claimSlot(uint256 groupId, address who, uint16 position) internal {
        Group storage g = groups[groupId];
        if (g.state != GroupState.Open) revert WrongState();
        if (block.timestamp > g.fillDeadline) revert FillDeadlinePassed();
        if (members[groupId][who].state != MemberState.None) revert AlreadyJoined();
        if (position == 0 || position > g.memberTarget) revert InvalidSlot();
        if (payoutOrder[groupId][position] != address(0)) revert SlotTaken();

        uint256 deposit = g.contributionAmount * (g.memberTarget - position);
        if (deposit > 0) {
            g.token.safeTransferFrom(who, address(this), deposit);
        }

        g.memberCount++;
        members[groupId][who] = Member({
            state: MemberState.Active,
            payoutPosition: position,
            roundsPaid: 0,
            escrowBalance: deposit,
            payoutReceived: false
        });
        payoutOrder[groupId][position] = who;

        emit SlotClaimed(groupId, who, position, deposit);

        if (g.memberCount == g.memberTarget) {
            g.state = GroupState.Active;
            g.currentRound = 1;
            g.roundStart = uint64(block.timestamp);
            emit GroupActivated(groupId, g.roundStart);
        }
    }

    // ------------------------------------------------------------------
    // contribute - just the round contribution; deposit already posted
    // ------------------------------------------------------------------

    function contribute(uint256 groupId) external nonReentrant {
        Group storage g = groups[groupId];
        Member storage m = members[groupId][msg.sender];

        if (g.state != GroupState.Active) revert WrongState();
        if (m.state != MemberState.Active) revert NotMember();
        if (m.roundsPaid >= g.currentRound) revert AlreadyPaidThisRound();

        g.token.safeTransferFrom(msg.sender, address(this), g.contributionAmount);

        m.roundsPaid = g.currentRound;
        g.potBalance += g.contributionAmount;
        g.contributionsThisRound++;

        emit Contributed(groupId, msg.sender, g.currentRound, g.contributionAmount);
    }

    // ------------------------------------------------------------------
    // triggerPayout - SKELETON (build next)
    // ------------------------------------------------------------------

    /**
     * Anyone can call once contributionsThisRound == active member count
     * (or deadline passed and defaults resolved). Sends potBalance to
     * payoutOrder[groupId][currentRound], marks payoutReceived, advances
     * round, resets pot + counter. Final round => Completed, refunds unlock.
     */
    /**
     * Permissionless: anyone may call, funds always go to the rightful
     * slot holder. PULL PATTERN: the pot is CREDITED to the recipient's
     * withdrawable balance - never transferred directly - so a frozen or
     * malicious recipient can never block the group's progress.
     */
    function triggerPayout(uint256 groupId) external nonReentrant {
        Group storage g = groups[groupId];
        if (g.state != GroupState.Active) revert WrongState();

        // A round may pay out in two situations:
        //   (a) everyone has contributed - full pot, any time; OR
        //   (b) the round deadline + grace has passed - fire with whatever
        //       was collected (Option A: money never freezes). The shortfall
        //       is recorded so a later kickDefaulter can repair the recipient.
        bool everyonePaid = g.contributionsThisRound >= g.memberCount;
        bool deadlinePassed = block.timestamp > g.roundStart + g.roundDuration + g.gracePeriod;
        if (!everyonePaid && !deadlinePassed) revert RoundIncomplete();

        address recipient = payoutOrder[groupId][g.currentRound];

        // Record any shortfall: a full pot is one contribution per active
        // member. What actually arrived is contributionsThisRound worth.
        uint16 missing = g.memberCount - g.contributionsThisRound; // 0 if everyone paid
        if (missing > 0) {
            uint256 shortBy = uint256(missing) * g.contributionAmount;
            roundShortfall[groupId][g.currentRound] = shortBy;
            shortedCollector[groupId][g.currentRound] = recipient;
            emit ShortPayout(groupId, g.currentRound, recipient, g.potBalance, shortBy);
        }

        // Release the drip: seized deposits spread evenly over remaining
        // pots (current round inclusive). Final round sweeps the remainder,
        // so integer-division dust can never be stranded.
        uint16 roundsRemaining = g.memberTarget - g.currentRound + 1;
        uint256 dripShare = g.dripReserve / roundsRemaining;
        g.dripReserve -= dripShare;
        uint256 gross = g.potBalance + dripShare;
        uint256 fee = (gross * g.feeBps) / 10000;
        uint256 amount = gross - fee;

        // EFFECTS (all state updated before any value moves - CEI)
        members[groupId][recipient].payoutReceived = true;
        g.potBalance = 0;
        g.contributionsThisRound = 0;
        withdrawable[groupId][recipient] += amount;
        if (fee > 0) {
            withdrawable[groupId][treasury] += fee;
            emit FeeAccrued(groupId, g.currentRound, fee);
        }

        emit PayoutTriggered(groupId, g.currentRound, recipient, amount);

        if (g.currentRound == g.memberTarget) {
            g.state = GroupState.Completed; // refunds now claimable
        } else {
            g.currentRound++;
            g.roundStart = uint64(block.timestamp);
        }
    }

    // ------------------------------------------------------------------
    // kickDefaulter - SKELETON (build next)
    // ------------------------------------------------------------------

    /**
     * Trustless, time-based. Callable by anyone when
     * block.timestamp > roundStart + roundDuration + gracePeriod
     * AND member.roundsPaid < currentRound.
     * Seizes escrowBalance, distributes to cover the defaulters remaining
     * obligations round by round (DECISION: into pot per round vs pro-rata
     * lump to members), sets MemberState.Defaulted, forfeits prior
     * contributions.
     */
    /**
     * Fully trustless and cause-blind: anyone may call once the round
     * deadline + grace period has passed for a member who hasn't paid.
     * Default forfeits EVERYTHING - deposit and prior contributions -
     * with no exceptions (any refund carve-out is a griefing vector).
     *
     * Post-collection defaulter: seized deposit exactly equals their
     * remaining obligations; the drip keeps every future pot full-sized.
     * Pre-collection defaulter: their unclaimed payout round is removed
     * (gap close - everyone behind shifts up, memberTarget shrinks) and
     * the seized deposit sweetens the remaining pots via the same drip.
     */
    function kickDefaulter(uint256 groupId, address defaulter) external nonReentrant {
        Group storage g = groups[groupId];
        Member storage m = members[groupId][defaulter];

        if (g.state != GroupState.Active) revert WrongState();
        if (m.state != MemberState.Active) revert NotDefaultable();
        if (m.roundsPaid >= g.currentRound) revert NotDefaultable(); // they paid
        if (block.timestamp <= g.roundStart + g.roundDuration + g.gracePeriod) {
            revert GraceNotExpired();
        }

        uint256 seized = m.escrowBalance;
        m.escrowBalance = 0;
        m.state = MemberState.Defaulted;
        g.memberCount--; // now counts ACTIVE members; triggerPayout gate uses it
        g.dripReserve += seized;

        if (!m.payoutReceived) {
            // Gap close: remove their payout round. Shift everyone behind
            // them up by one, updating BOTH books (mapping + member field)
            // in lockstep, then shrink the target.
            uint16 p = m.payoutPosition;
            for (uint16 k = p; k < g.memberTarget; k++) {
                address moved = payoutOrder[groupId][k + 1];
                payoutOrder[groupId][k] = moved;
                members[groupId][moved].payoutPosition = k;
            }
            delete payoutOrder[groupId][g.memberTarget];
            g.memberTarget--;
        }

        emit MemberDefaulted(groupId, defaulter, g.currentRound, seized);
    }

    // ------------------------------------------------------------------
    // claimEscrowRefund - SKELETON (build next)
    // ------------------------------------------------------------------

    /**
     * After GroupState.Completed, each non-defaulted member withdraws
     * their full escrowBalance.
     */
    /**
     * Permissionless escape hatch for groups that never filled.
     * Time is the authority: nobody (including the creator and CAjo)
     * can cancel before the fill deadline; after it, anyone can, because
     * cancellation only unlocks each member's own deposit for reclaim.
     */
    function cancelIfUnfilled(uint256 groupId) external {
        Group storage g = groups[groupId];
        if (g.state != GroupState.Open) revert WrongState();
        if (block.timestamp <= g.fillDeadline) revert FillDeadlineNotPassed();
        g.state = GroupState.Cancelled;
        emit GroupCancelled(groupId);
    }

    function claimEscrowRefund(uint256 groupId) external nonReentrant {
        Group storage g = groups[groupId];
        Member storage m = members[groupId][msg.sender];
        if (g.state != GroupState.Completed && g.state != GroupState.Cancelled) revert NotCompleted();
        if (m.state != MemberState.Active) revert NotMember(); // defaulted members forfeited
        uint256 amount = m.escrowBalance;
        if (amount == 0) revert NothingToRefund();

        m.escrowBalance = 0; // effect before interaction
        withdrawable[groupId][msg.sender] += amount;
        emit EscrowRefunded(groupId, msg.sender, amount);
    }

    /**
     * The ONLY function that sends tokens out. Each user withdraws their
     * own credited balance; a failed transfer (e.g. USDT-frozen address)
     * harms only the caller and can be retried after resolution.
     */
    function withdraw(uint256 groupId) external nonReentrant {
        uint256 amount = withdrawable[groupId][msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        withdrawable[groupId][msg.sender] = 0; // effect strictly before interaction
        groups[groupId].token.safeTransfer(msg.sender, amount);
        emit Withdrawn(groupId, msg.sender, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getGroupStatus(uint256 groupId) external view returns (
        GroupState state,
        uint16 currentRound,
        uint16 memberCount,
        uint256 potBalance,
        uint16 contributionsThisRound,
        uint64 roundDeadline
    ) {
        Group storage g = groups[groupId];
        return (
            g.state,
            g.currentRound,
            g.memberCount,
            g.potBalance,
            g.contributionsThisRound,
            g.roundStart + g.roundDuration
        );
    }

    function openSlots(uint256 groupId) external view returns (bool[] memory taken) {
        Group storage g = groups[groupId];
        taken = new bool[](g.memberTarget);
        for (uint16 i = 1; i <= g.memberTarget; i++) {
            taken[i - 1] = payoutOrder[groupId][i] != address(0);
        }
    }
}
