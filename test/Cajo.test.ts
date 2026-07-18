import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

/**
 * CAjo v1 test suite - createGroup / joinGroup / contribute
 * Run: npx hardhat test
 *
 * Group under test: 5 members, 100 USDT contribution, daily rounds.
 * Slot deposits: pos1=400, pos2=300, pos3=200, pos4=100, pos5=0.
 */

const USDT = (n: string) => ethers.parseUnits(n, 18); // BSC USDT = 18 decimals
const CONTRIBUTION = USDT("100");
const MEMBERS = 5;
const ROUND = 7n * 24n * 3600n; // 7 days
const GRACE = 24n * 3600n;      // 24 hours
const MODE_PUBLIC = 0;
const MODE_FRIENDS = 1;

describe("Cajo", () => {
  async function deployFixture() {
    const signers = await ethers.getSigners();
    const [a, b, c, d, e, outsider] = signers;

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();

    const Cajo = await ethers.getContractFactory("Cajo");
    const cajo = await Cajo.deploy();

    // Fund everyone generously and pre-approve the contract
    for (const s of [a, b, c, d, e, outsider]) {
      await usdt.mint(s.address, USDT("10000"));
      await usdt.connect(s).approve(await cajo.getAddress(), USDT("10000"));
    }

    return { cajo, usdt, a, b, c, d, e, outsider };
  }

  // creator takes slot 5 (deposit 0) unless stated otherwise
  async function createdGroupFixture() {
    const f = await deployFixture();
    await f.cajo
      .connect(f.a)
      .createGroup(await f.usdt.getAddress(), CONTRIBUTION, MEMBERS, ROUND, GRACE, MODE_PUBLIC, 5);
    return { ...f, groupId: 1n };
  }

  async function activeGroupFixture() {
    const f = await createdGroupFixture();
    await f.cajo.connect(f.b).joinGroup(f.groupId, 1); // deposit 400
    await f.cajo.connect(f.c).joinGroup(f.groupId, 2); // deposit 300
    await f.cajo.connect(f.d).joinGroup(f.groupId, 3); // deposit 200
    await f.cajo.connect(f.e).joinGroup(f.groupId, 4); // deposit 100
    return f;
  }

  // ------------------------------------------------------------------
  // createGroup
  // ------------------------------------------------------------------

  describe("createGroup", () => {
    it("creates a group and auto-joins the creator at their chosen slot", async () => {
      const { cajo, usdt, a } = await loadFixture(deployFixture);
      await expect(
        cajo.connect(a).createGroup(await usdt.getAddress(), CONTRIBUTION, MEMBERS, ROUND, GRACE, MODE_PUBLIC, 5)
      )
        .to.emit(cajo, "GroupCreated")
        .and.to.emit(cajo, "SlotClaimed");

      const m = await cajo.members(1, a.address);
      expect(m.payoutPosition).to.equal(5);
      expect(m.escrowBalance).to.equal(0); // last slot is free
    });

    it("charges the creator the slot deposit if they take an early slot", async () => {
      const { cajo, usdt, a } = await loadFixture(deployFixture);
      const before = await usdt.balanceOf(a.address);
      await cajo.connect(a).createGroup(await usdt.getAddress(), CONTRIBUTION, MEMBERS, ROUND, GRACE, MODE_PUBLIC, 1);
      const after = await usdt.balanceOf(a.address);
      expect(before - after).to.equal(USDT("400")); // 100 * (5 - 1)
    });

    it("rejects Friends mode in v1", async () => {
      const { cajo, usdt, a } = await loadFixture(deployFixture);
      await expect(
        cajo.connect(a).createGroup(await usdt.getAddress(), CONTRIBUTION, MEMBERS, ROUND, GRACE, MODE_FRIENDS, 5)
      ).to.be.revertedWithCustomError(cajo, "ModeNotSupported");
    });

    it("rejects nonsense parameters", async () => {
      const { cajo, usdt, a } = await loadFixture(deployFixture);
      const t = await usdt.getAddress();
      const cg = (contr: bigint, members: number, round: bigint, grace: bigint) =>
        cajo.connect(a).createGroup(t, contr, members, round, grace, MODE_PUBLIC, 1);

      await expect(cg(0n, MEMBERS, ROUND, GRACE)).to.be.revertedWithCustomError(cajo, "InvalidParams"); // zero contribution
      await expect(cg(CONTRIBUTION, 1, ROUND, GRACE)).to.be.revertedWithCustomError(cajo, "InvalidParams"); // 1 member
      await expect(cg(CONTRIBUTION, 51, ROUND, GRACE)).to.be.revertedWithCustomError(cajo, "InvalidParams"); // > cap
      await expect(cg(CONTRIBUTION, MEMBERS, 3600n, GRACE)).to.be.revertedWithCustomError(cajo, "InvalidParams"); // round < 1 day
      await expect(cg(CONTRIBUTION, MEMBERS, ROUND, 60n)).to.be.revertedWithCustomError(cajo, "InvalidParams"); // grace < 6h
    });
  });

  // ------------------------------------------------------------------
  // joinGroup - reverse-risk slot claiming
  // ------------------------------------------------------------------

  describe("joinGroup", () => {
    it("prices slots by reverse risk: earlier payout = bigger deposit", async () => {
      const { cajo, groupId } = await loadFixture(createdGroupFixture);
      expect(await cajo.slotDeposit(groupId, 1)).to.equal(USDT("400"));
      expect(await cajo.slotDeposit(groupId, 2)).to.equal(USDT("300"));
      expect(await cajo.slotDeposit(groupId, 3)).to.equal(USDT("200"));
      expect(await cajo.slotDeposit(groupId, 4)).to.equal(USDT("100"));
      expect(await cajo.slotDeposit(groupId, 5)).to.equal(USDT("0"));
    });

    it("pulls the exact deposit when a slot is claimed", async () => {
      const { cajo, usdt, b, groupId } = await loadFixture(createdGroupFixture);
      const before = await usdt.balanceOf(b.address);
      await cajo.connect(b).joinGroup(groupId, 1);
      expect(before - (await usdt.balanceOf(b.address))).to.equal(USDT("400"));
      const m = await cajo.members(groupId, b.address);
      expect(m.escrowBalance).to.equal(USDT("400"));
    });

    it("ATTACK: cannot claim an already-taken slot", async () => {
      const { cajo, b, c, groupId } = await loadFixture(createdGroupFixture);
      await cajo.connect(b).joinGroup(groupId, 1);
      await expect(cajo.connect(c).joinGroup(groupId, 1)).to.be.revertedWithCustomError(cajo, "SlotTaken");
    });

    it("ATTACK: cannot join the same group twice from one wallet", async () => {
      const { cajo, b, groupId } = await loadFixture(createdGroupFixture);
      await cajo.connect(b).joinGroup(groupId, 1);
      await expect(cajo.connect(b).joinGroup(groupId, 2)).to.be.revertedWithCustomError(cajo, "AlreadyJoined");
    });

    it("ATTACK: cannot claim slot 0 or a slot beyond the member target", async () => {
      const { cajo, b, groupId } = await loadFixture(createdGroupFixture);
      await expect(cajo.connect(b).joinGroup(groupId, 0)).to.be.revertedWithCustomError(cajo, "InvalidSlot");
      await expect(cajo.connect(b).joinGroup(groupId, 6)).to.be.revertedWithCustomError(cajo, "InvalidSlot");
    });

    it("ATTACK: cannot join once the group is full and active", async () => {
      const { cajo, outsider, groupId } = await loadFixture(activeGroupFixture);
      await expect(cajo.connect(outsider).joinGroup(groupId, 1)).to.be.revertedWithCustomError(cajo, "WrongState");
    });

    it("activates the group exactly when the last slot fills", async () => {
      const { cajo, b, c, d, e, groupId } = await loadFixture(createdGroupFixture);
      await cajo.connect(b).joinGroup(groupId, 1);
      await cajo.connect(c).joinGroup(groupId, 2);
      await cajo.connect(d).joinGroup(groupId, 3);

      let s = await cajo.getGroupStatus(groupId);
      expect(s.state).to.equal(0); // Open
      expect(s.currentRound).to.equal(0);

      await expect(cajo.connect(e).joinGroup(groupId, 4)).to.emit(cajo, "GroupActivated");
      s = await cajo.getGroupStatus(groupId);
      expect(s.state).to.equal(1); // Active
      expect(s.currentRound).to.equal(1);
    });

    it("reports open slots correctly for the frontend", async () => {
      const { cajo, b, groupId } = await loadFixture(createdGroupFixture);
      await cajo.connect(b).joinGroup(groupId, 2);
      const taken = await cajo.openSlots(groupId);
      expect(taken).to.deep.equal([false, true, false, false, true]); // slot 2 (b) + slot 5 (creator)
    });
  });

  // ------------------------------------------------------------------
  // contribute
  // ------------------------------------------------------------------

  describe("contribute", () => {
    it("pulls exactly the contribution amount and grows the pot", async () => {
      const { cajo, usdt, b, groupId } = await loadFixture(activeGroupFixture);
      const before = await usdt.balanceOf(b.address);
      await expect(cajo.connect(b).contribute(groupId)).to.emit(cajo, "Contributed");
      expect(before - (await usdt.balanceOf(b.address))).to.equal(CONTRIBUTION);

      const s = await cajo.getGroupStatus(groupId);
      expect(s.potBalance).to.equal(CONTRIBUTION);
      expect(s.contributionsThisRound).to.equal(1);
    });

    it("all five members contribute and the pot equals one full payout", async () => {
      const { cajo, a, b, c, d, e, groupId } = await loadFixture(activeGroupFixture);
      for (const s of [a, b, c, d, e]) await cajo.connect(s).contribute(groupId);
      const st = await cajo.getGroupStatus(groupId);
      expect(st.potBalance).to.equal(USDT("500"));
      expect(st.contributionsThisRound).to.equal(5);
    });

    it("ATTACK: cannot contribute twice in the same round", async () => {
      const { cajo, b, groupId } = await loadFixture(activeGroupFixture);
      await cajo.connect(b).contribute(groupId);
      await expect(cajo.connect(b).contribute(groupId)).to.be.revertedWithCustomError(cajo, "AlreadyPaidThisRound");
    });

    it("ATTACK: a non-member cannot contribute", async () => {
      const { cajo, outsider, groupId } = await loadFixture(activeGroupFixture);
      await expect(cajo.connect(outsider).contribute(groupId)).to.be.revertedWithCustomError(cajo, "NotMember");
    });

    it("ATTACK: cannot contribute to a group that is still Open", async () => {
      const { cajo, b, groupId } = await loadFixture(createdGroupFixture);
      await expect(cajo.connect(b).contribute(groupId)).to.be.revertedWithCustomError(cajo, "WrongState");
    });

    it("ATTACK: contribution fails without sufficient allowance", async () => {
      const { cajo, usdt, b, groupId } = await loadFixture(activeGroupFixture);
      await usdt.connect(b).approve(await cajo.getAddress(), 0); // revoke
      await expect(cajo.connect(b).contribute(groupId)).to.be.reverted; // SafeERC20 bubble-up
    });
  });

  // ------------------------------------------------------------------
  // Escrow accounting invariant
  // ------------------------------------------------------------------

  describe("invariants", () => {
    it("contract balance always equals sum of deposits + pot", async () => {
      const { cajo, usdt, a, b, c, groupId } = await loadFixture(activeGroupFixture);
      await cajo.connect(a).contribute(groupId);
      await cajo.connect(b).contribute(groupId);
      await cajo.connect(c).contribute(groupId);

      const deposits = USDT("400") + USDT("300") + USDT("200") + USDT("100") + USDT("0");
      const pot = CONTRIBUTION * 3n;
      expect(await usdt.balanceOf(await cajo.getAddress())).to.equal(deposits + pot);
    });
  });
});

// ------------------------------------------------------------------
// triggerPayout + withdraw - full pull-pattern cycle
// ------------------------------------------------------------------

describe("triggerPayout", () => {
  const fullRound = async (f: any) => {
    for (const s of [f.a, f.b, f.c, f.d, f.e]) await f.cajo.connect(s).contribute(f.groupId);
  };

  async function activeGroup() {
    const signers = await ethers.getSigners();
    const [a, b, c, d, e, outsider] = signers;
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    const Cajo = await ethers.getContractFactory("Cajo");
    const cajo = await Cajo.deploy();
    for (const s of [a, b, c, d, e, outsider]) {
      await usdt.mint(s.address, USDT("10000"));
      await usdt.connect(s).approve(await cajo.getAddress(), USDT("10000"));
    }
    await cajo.connect(a).createGroup(await usdt.getAddress(), CONTRIBUTION, MEMBERS, ROUND, GRACE, MODE_PUBLIC, 5);
    await cajo.connect(b).joinGroup(1, 1);
    await cajo.connect(c).joinGroup(1, 2);
    await cajo.connect(d).joinGroup(1, 3);
    await cajo.connect(e).joinGroup(1, 4);
    return { cajo, usdt, a, b, c, d, e, outsider, groupId: 1n };
  }

  it("credits the full pot to the slot-1 holder after round 1", async () => {
    const f = await loadFixture(activeGroup);
    await fullRound(f);
    await expect(f.cajo.connect(f.outsider).triggerPayout(f.groupId)) // permissionless
      .to.emit(f.cajo, "PayoutTriggered");
    expect(await f.cajo.withdrawable(f.groupId, f.b.address)).to.equal(USDT("500")); // b holds slot 1
  });

  it("ATTACK: cannot trigger before every member has contributed", async () => {
    const f = await loadFixture(activeGroup);
    await f.cajo.connect(f.a).contribute(f.groupId);
    await expect(f.cajo.triggerPayout(f.groupId)).to.be.revertedWithCustomError(f.cajo, "RoundIncomplete");
  });

  it("ATTACK: cannot double-trigger the same round to drain credits", async () => {
    const f = await loadFixture(activeGroup);
    await fullRound(f);
    await f.cajo.triggerPayout(f.groupId);
    // pot is now 0 and contributions reset - second call must fail
    await expect(f.cajo.triggerPayout(f.groupId)).to.be.revertedWithCustomError(f.cajo, "RoundIncomplete");
  });

  it("advances rounds in slot order and completes after the final round", async () => {
    const f = await loadFixture(activeGroup);
    const order = [f.b, f.c, f.d, f.e, f.a]; // slots 1..5
    for (let r = 0; r < 5; r++) {
      await fullRound(f);
      await f.cajo.triggerPayout(f.groupId);
      expect(await f.cajo.withdrawable(f.groupId, order[r].address)).to.be.gte(USDT("500"));
    }
    const s = await f.cajo.getGroupStatus(f.groupId);
    expect(s.state).to.equal(2); // Completed
  });

  it("withdraw sends exactly the credited amount and zeroes the credit", async () => {
    const f = await loadFixture(activeGroup);
    await fullRound(f);
    await f.cajo.triggerPayout(f.groupId);
    const before = await f.usdt.balanceOf(f.b.address);
    await expect(f.cajo.connect(f.b).withdraw(f.groupId)).to.emit(f.cajo, "Withdrawn");
    expect((await f.usdt.balanceOf(f.b.address)) - before).to.equal(USDT("500"));
    await expect(f.cajo.connect(f.b).withdraw(f.groupId)).to.be.revertedWithCustomError(f.cajo, "NothingToWithdraw");
  });

  it("ATTACK: a stranger with no credit cannot withdraw anything", async () => {
    const f = await loadFixture(activeGroup);
    await fullRound(f);
    await f.cajo.triggerPayout(f.groupId);
    await expect(f.cajo.connect(f.outsider).withdraw(f.groupId)).to.be.revertedWithCustomError(f.cajo, "NothingToWithdraw");
  });

  it("ATTACK: escrow refund is locked until the group completes", async () => {
    const f = await loadFixture(activeGroup);
    await expect(f.cajo.connect(f.b).claimEscrowRefund(f.groupId)).to.be.revertedWithCustomError(f.cajo, "NotCompleted");
  });

  it("full lifecycle: everyone ends net-zero (minus nothing - no fees in v1)", async () => {
    const f = await loadFixture(activeGroup);
    const start: Record<string, bigint> = {};
    for (const s of [f.a, f.b, f.c, f.d, f.e]) start[s.address] = await f.usdt.balanceOf(s.address);

    for (let r = 0; r < 5; r++) { await fullRound(f); await f.cajo.triggerPayout(f.groupId); }
    for (const s of [f.a, f.b, f.c, f.d, f.e]) {
      await f.cajo.connect(s).claimEscrowRefund(f.groupId).catch(() => {}); // slot 5 had 0 escrow
      await f.cajo.connect(s).withdraw(f.groupId);
    }
    // Baselines were recorded AFTER deposits were paid, so each member should
    // end at baseline + refunded deposit. Slots: b=400, c=300, d=200, e=100, a=0.
    const refunds: [any, bigint][] = [
      [f.a, USDT("0")], [f.b, USDT("400")], [f.c, USDT("300")],
      [f.d, USDT("200")], [f.e, USDT("100")],
    ];
    for (const [s, dep] of refunds) {
      expect(await f.usdt.balanceOf(s.address)).to.equal(start[s.address] + dep);
    }
    // The contract must end EMPTY - no dust, no stuck funds.
    expect(await f.usdt.balanceOf(await f.cajo.getAddress())).to.equal(0);
  });
});

// ------------------------------------------------------------------
// kickDefaulter - time-based defaults, drip, gap close
// ------------------------------------------------------------------

import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("kickDefaulter", () => {
  async function activeGroup2() {
    const [a, b, c, d, e, outsider] = await ethers.getSigners();
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    const Cajo = await ethers.getContractFactory("Cajo");
    const cajo = await Cajo.deploy();
    for (const s of [a, b, c, d, e, outsider]) {
      await usdt.mint(s.address, USDT("10000"));
      await usdt.connect(s).approve(await cajo.getAddress(), USDT("10000"));
    }
    await cajo.connect(a).createGroup(await usdt.getAddress(), CONTRIBUTION, MEMBERS, ROUND, GRACE, MODE_PUBLIC, 5);
    await cajo.connect(b).joinGroup(1, 1); // deposit 400
    await cajo.connect(c).joinGroup(1, 2); // deposit 300
    await cajo.connect(d).joinGroup(1, 3); // deposit 200
    await cajo.connect(e).joinGroup(1, 4); // deposit 100
    return { cajo, usdt, a, b, c, d, e, outsider, groupId: 1n };
  }
  const pastDeadline = async () => time.increase(Number(ROUND + GRACE) + 1);

  it("ATTACK: cannot kick before the grace period expires", async () => {
    const f = await loadFixture(activeGroup2);
    await expect(f.cajo.kickDefaulter(f.groupId, f.b.address))
      .to.be.revertedWithCustomError(f.cajo, "GraceNotExpired");
  });

  it("ATTACK: cannot kick a member who has paid this round", async () => {
    const f = await loadFixture(activeGroup2);
    await f.cajo.connect(f.b).contribute(f.groupId);
    await pastDeadline();
    await expect(f.cajo.kickDefaulter(f.groupId, f.b.address))
      .to.be.revertedWithCustomError(f.cajo, "NotDefaultable");
  });

  it("ATTACK: cannot kick the same defaulter twice (no double-seizure)", async () => {
    const f = await loadFixture(activeGroup2);
    for (const s of [f.a, f.c, f.d, f.e]) await f.cajo.connect(s).contribute(f.groupId);
    await pastDeadline();
    await f.cajo.kickDefaulter(f.groupId, f.b.address);
    await expect(f.cajo.kickDefaulter(f.groupId, f.b.address))
      .to.be.revertedWithCustomError(f.cajo, "NotDefaultable");
  });

  it("kicked members can no longer contribute or claim refunds", async () => {
    const f = await loadFixture(activeGroup2);
    for (const s of [f.a, f.c, f.d, f.e]) await f.cajo.connect(s).contribute(f.groupId);
    await pastDeadline();
    await f.cajo.kickDefaulter(f.groupId, f.b.address);
    await expect(f.cajo.connect(f.b).contribute(f.groupId))
      .to.be.revertedWithCustomError(f.cajo, "NotMember");
  });

  it("PRE-collection default: gap closes, positions shift up, target shrinks, deposits still fit", async () => {
    const f = await loadFixture(activeGroup2);
    // e (slot 4, deposit 100) never pays round 1. Others pay.
    for (const s of [f.a, f.b, f.c, f.d]) await f.cajo.connect(s).contribute(f.groupId);
    await pastDeadline();
    await f.cajo.connect(f.outsider).kickDefaulter(f.groupId, f.e.address); // permissionless

    // a held slot 5 -> shifts up to slot 4; target now 4
    const ma = await f.cajo.members(f.groupId, f.a.address);
    expect(ma.payoutPosition).to.equal(4);
    expect(await f.cajo.payoutOrder(f.groupId, 4)).to.equal(f.a.address);
    expect(await f.cajo.payoutOrder(f.groupId, 5)).to.equal(ethers.ZeroAddress);

    // Deposit formula still exact for the shifted member: 100 * (4 - 4) = 0 = what a paid
    expect(await f.cajo.slotDeposit(f.groupId, 4)).to.equal(USDT("0"));

    // Round 1 pot: 4 live contributions + seized 100 spread over 4 remaining rounds (+25)
    await f.cajo.triggerPayout(f.groupId);
    expect(await f.cajo.withdrawable(f.groupId, f.b.address)).to.equal(USDT("425"));
  });

  it("POST-collection default: drip keeps every remaining pot full-sized", async () => {
    const f = await loadFixture(activeGroup2);
    // Round 1: everyone pays, b (slot 1) collects 500.
    for (const s of [f.a, f.b, f.c, f.d, f.e]) await f.cajo.connect(s).contribute(f.groupId);
    await f.cajo.triggerPayout(f.groupId);
    // Round 2: b ghosts. Others pay. Kick b after deadline.
    for (const s of [f.a, f.c, f.d, f.e]) await f.cajo.connect(s).contribute(f.groupId);
    await pastDeadline();
    await f.cajo.kickDefaulter(f.groupId, f.b.address); // seizes b's 400

    // No gap close (b already collected): c is still slot 2, target still 5
    expect(await f.cajo.payoutOrder(f.groupId, 2)).to.equal(f.c.address);

    // Pot = 400 live + 400/4 remaining rounds = 500. Full size, nobody feels it.
    await f.cajo.triggerPayout(f.groupId);
    expect(await f.cajo.withdrawable(f.groupId, f.c.address)).to.equal(USDT("500"));
  });

  it("lifecycle with a post-collection default conserves money and empties the contract", async () => {
    const f = await loadFixture(activeGroup2);
    for (const s of [f.a, f.b, f.c, f.d, f.e]) await f.cajo.connect(s).contribute(f.groupId);
    await f.cajo.triggerPayout(f.groupId);                       // b collects 500
    for (let round = 2; round <= 5; round++) {
      for (const s of [f.a, f.c, f.d, f.e]) await f.cajo.connect(s).contribute(f.groupId);
      if (round === 2) { await pastDeadline(); await f.cajo.kickDefaulter(f.groupId, f.b.address); }
      await f.cajo.triggerPayout(f.groupId);                     // pots stay 500 via drip
    }
    const st = await f.cajo.getGroupStatus(f.groupId);
    expect(st.state).to.equal(2); // Completed

    for (const s of [f.a, f.c, f.d, f.e]) {
      await f.cajo.connect(s).claimEscrowRefund(f.groupId).catch(() => {}); // a had 0 escrow
      await f.cajo.connect(s).withdraw(f.groupId);
    }
    await expect(f.cajo.connect(f.b).claimEscrowRefund(f.groupId))
      .to.be.revertedWithCustomError(f.cajo, "NotMember"); // defaulter forfeited

    // b withdraws their round-1 payout credit (already theirs before defaulting)
    await f.cajo.connect(f.b).withdraw(f.groupId);

    // Contract must end EMPTY: drip fully disbursed, no stranded dust.
    expect(await f.usdt.balanceOf(await f.cajo.getAddress())).to.equal(0);
  });
});
