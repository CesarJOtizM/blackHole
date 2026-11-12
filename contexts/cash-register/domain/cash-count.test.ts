import { expect, it } from "vitest";

import {
  CashCount,
  CountingRejectsCharges,
  InvalidCountId,
  SelfApprovalRejected,
  ShiftClosed,
  type SubmitCashCount,
  VarianceNeedsApproval,
} from "#domain/cash-count.js";
import { InvalidCashAmount } from "#domain/cash-shift.js";

const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const COUNT_ID = "count_front_1";
const EXPECTED_CASH_COP = 100_000;
const SHORT_COP = 10_000;
const TERMINAL_ID = "T";
const RECORDED_COP = 900_000;
const REPORTED_COP = 880_000;
const TERMINAL_GAP_COP = 20_000;
const CORRECTION_ID = "movement_correction_1";
const ORIGINAL_PAYMENT_ID = "payment_original";
const CORRECTION_COP = 4_000;
const CORRECTION_REASON = "Fix a tender";

const countForCashier = () =>
  CashCount.start({ id: COUNT_ID, countedBy: CASHIER_ID });

const balancedCount = (): SubmitCashCount => ({
  denominations: [{ denomination: 50_000, quantity: 2 }],
  expectedCashCop: EXPECTED_CASH_COP,
  terminals: [],
});

const shortCount = (): SubmitCashCount => ({
  denominations: [{ denomination: 10_000, quantity: 9 }],
  expectedCashCop: EXPECTED_CASH_COP,
  terminals: [],
});

const shortSubmitted = () => {
  const count = countForCashier();
  count.submit(shortCount());
  return count;
};

const snapshotOf = (count: CashCount) => ({
  id: count.id,
  countedBy: count.countedBy,
  state: count.state,
  expectedCashCop: count.expectedCashCop,
  countedCashCop: count.countedCashCop,
  differenceCop: count.differenceCop,
  denominations: count.denominations,
  terminalDifferences: count.terminalDifferences,
});

it("given expected cash of 300000 and qr of 120000 against its report, when the count is submitted, then expectedCashCop stays 300000", () => {
  const count = countForCashier();

  count.submit({
    denominations: [{ denomination: 100_000, quantity: 3 }],
    expectedCashCop: 300_000,
    terminals: [],
    qrCop: 120_000,
    qrReportCop: 120_000,
  });

  expect(count.expectedCashCop).toBe(300_000);
  expect(count.countedCashCop).toBe(300_000);
  expect(count.differenceCop).toBe(0);
  expect(count.qrCop).toBe(120_000);
  expect(count.qrReportCop).toBe(120_000);
});

it("given the cashier has not submitted the count, when the shift is viewed, then no expected yet", () => {
  const count = countForCashier();

  expect(count.state).toBe("open");
  expect(count.expectedCashCop).toBeUndefined();
  expect(count.countedCashCop).toBeUndefined();
  expect(count.differenceCop).toBeUndefined();
  expect(count.terminalDifferences).toEqual([]);
});

it("given the count is 10000 short, when the cashier closes the shift, then VarianceNeedsApproval and it stays counting", () => {
  const count = shortSubmitted();
  const before = snapshotOf(count);

  const close = () => {
    count.finalClose();
  };

  expect(count.countedCashCop).toBe(EXPECTED_CASH_COP - SHORT_COP);
  expect(count.differenceCop).toBe(-SHORT_COP);
  expect(close).toThrow(VarianceNeedsApproval);
  expect(snapshotOf(count)).toEqual(before);
  expect(count.state).toBe("counting");
});

it("given the count is 10000 short, when another person approves without a justification, then VarianceNeedsApproval and it stays counting", () => {
  const count = shortSubmitted();
  const before = snapshotOf(count);

  const approve = () => {
    count.approve({ approverId: SUPERVISOR_ID, justification: "  " });
  };

  expect(approve).toThrow(VarianceNeedsApproval);
  expect(() => count.finalClose()).toThrow(VarianceNeedsApproval);
  expect(snapshotOf(count)).toEqual(before);
  expect(count.state).toBe("counting");
});

it("given a difference, when the cashier approves their own count, then SelfApprovalRejected and it stays counting", () => {
  const count = shortSubmitted();
  const before = snapshotOf(count);

  const approve = () => {
    count.approve({
      approverId: CASHIER_ID,
      justification: "Drawer was short",
    });
  };

  expect(approve).toThrow(SelfApprovalRejected);
  expect(() => count.finalClose()).toThrow(VarianceNeedsApproval);
  expect(snapshotOf(count)).toEqual(before);
  expect(count.state).toBe("counting");
});

it("given the count is 10000 short, when another person approves and the cashier closes, then the shift is closed", () => {
  const count = shortSubmitted();

  count.approve({
    approverId: SUPERVISOR_ID,
    justification: "Drawer was short",
  });

  expect(count.state).toBe("counting");

  count.finalClose();

  expect(count.state).toBe("closed");
});

it("given terminal T recorded 900000 and its report says 880000, when reconciliation runs, then a 20000 difference is shown for T", () => {
  const count = countForCashier();

  count.submit({
    denominations: [{ denomination: 50_000, quantity: 2 }],
    expectedCashCop: EXPECTED_CASH_COP,
    terminals: [
      {
        terminalId: TERMINAL_ID,
        recordedCop: RECORDED_COP,
        reportedCop: REPORTED_COP,
      },
    ],
  });

  expect(count.terminalDifferences).toEqual([
    { terminalId: TERMINAL_ID, differenceCop: TERMINAL_GAP_COP },
  ]);
  expect(count.differenceCop).toBe(0);
  expect(() => count.finalClose()).toThrow(VarianceNeedsApproval);
  expect(count.state).toBe("counting");
});

it("given the shift is counting, when a new charge is recorded, then it is rejected and nothing is stored", () => {
  const count = countForCashier();
  count.submit(balancedCount());
  const charges: string[] = [];

  const charge = () => {
    count.recordCharge();
    charges.push("payment_during_count");
  };

  expect(charge).toThrow(CountingRejectsCharges);
  expect(charges).toEqual([]);
  expect(count.state).toBe("counting");
});

it("given an open shift, when a partial close is done, then the shift stays open and keeps receiving payments", () => {
  const count = countForCashier();

  count.partialClose();

  expect(count.state).toBe("open");
  expect(() => count.recordCharge()).not.toThrow();
});

it("given a submitted count, when a partial close is done, then the shift stays open and keeps receiving payments", () => {
  const count = countForCashier();
  count.submit(balancedCount());

  count.partialClose();

  expect(count.state).toBe("open");
  expect(() => count.recordCharge()).not.toThrow();
});

it("given a closed shift, when a payment is added or edited, then ShiftClosed and the count stays", () => {
  const count = countForCashier();
  count.submit(balancedCount());
  count.finalClose();
  const before = snapshotOf(count);
  const changes: string[] = [];

  const add = () => {
    count.recordCharge();
    changes.push("added");
  };
  const edit = () => {
    count.editPayment();
    changes.push("edited");
  };

  expect(count.state).toBe("closed");
  expect(add).toThrow(ShiftClosed);
  expect(edit).toThrow(ShiftClosed);
  expect(changes).toEqual([]);
  expect(snapshotOf(count)).toEqual(before);
});

it("given a closed shift, when a correction is recorded, then it is a new movement and the count is not edited", () => {
  const count = countForCashier();
  count.submit(balancedCount());
  count.finalClose();
  const before = snapshotOf(count);

  count.correct({
    id: CORRECTION_ID,
    referencesId: ORIGINAL_PAYMENT_ID,
    amountCop: CORRECTION_COP,
    reason: CORRECTION_REASON,
  });

  expect(count.corrections).toEqual([
    {
      id: CORRECTION_ID,
      referencesId: ORIGINAL_PAYMENT_ID,
      amountCop: CORRECTION_COP,
      reason: CORRECTION_REASON,
    },
  ]);
  expect(snapshotOf(count)).toEqual(before);
  expect(count.state).toBe("closed");
});

it("given a count id without the count_ prefix, when the count starts, then InvalidCountId and nothing is stored", () => {
  const stored: CashCount[] = [];

  const start = () => {
    stored.push(
      CashCount.start({ id: "shift_front_1", countedBy: CASHIER_ID }),
    );
  };

  expect(start).toThrow(InvalidCountId);
  expect(stored).toEqual([]);
});

it("given a fractional COP quantity, when the count is submitted, then InvalidCashAmount and no expected yet", () => {
  const count = countForCashier();

  const submit = () => {
    count.submit({
      denominations: [{ denomination: 50_000, quantity: 1.5 }],
      expectedCashCop: EXPECTED_CASH_COP,
      terminals: [],
    });
  };

  expect(submit).toThrow(InvalidCashAmount);
  expect(count.expectedCashCop).toBeUndefined();
  expect(count.state).toBe("open");
});
