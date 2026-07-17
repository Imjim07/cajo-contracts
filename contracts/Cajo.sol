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
        GroupState state;
        EscrowMode escrowMode;
        uint256 potBalance;         // contributions awaiting payout this round
        uint16 contributionsThisRound;
    }

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    uint256 public groupCount;
    mapping(uint256 => Group) public groups;
    mapping(uint256 => mapping(address => Member)) public members;
    mapping(uint256 => mapping(uint16 => address)) public payoutOrder; // groupId => position => member

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

    // ------------------------------------------------------------------
    // createGroup
    // ------------------------------------------------------------------

    function createGroup(
        IERC20 token,
        uint256 contributionAmount,
        uint16 memberTarget,
        uint64 roundDuration,
        uint64 gracePeriod,
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
            gracePeriod < 6 hours
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
    function triggerPayout(uint256 groupId) external nonReentrant {
        revert("not implemented");
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
    function kickDefaulter(uint256 groupId, address defaulter) external nonReentrant {
        revert("not implemented");
    }

    // ------------------------------------------------------------------
    // claimEscrowRefund - SKELETON (build next)
    // ------------------------------------------------------------------

    /**
     * After GroupState.Completed, each non-defaulted member withdraws
     * their full escrowBalance.
     */
    function claimEscrowRefund(uint256 groupId) external nonReentrant {
        revert("not implemented");
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
