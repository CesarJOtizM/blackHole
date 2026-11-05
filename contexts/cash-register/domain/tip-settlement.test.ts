import { expect, it } from "vitest";

import {
  TipSettlements,
  TipShareEditRejected,
} from "#domain/tip-settlement.js";

const ANA = "user-ana";
const COOK = "user-cook";
const SETTLEMENT_ID = "settlement_week";
const ADJUSTMENT_ID = "settlement_week-adjustment";

it("given a closed settlement, when the supplied rule and share change afterward, then the stored snapshot keeps the original", () => {
  const ruleShares = [{ employeeId: COOK, percent: 40 }];
  const shares = [
    { userId: ANA, baseCop: 60000, residueCop: 0 },
    { userId: COOK, baseCop: 0, residueCop: 0 },
  ];
  const book = TipSettlements.empty();
  const closed = book.close({
    id: SETTLEMENT_ID,
    poolCop: 100000,
    participants: [
      { userId: ANA, workedMinutes: 480 },
      { userId: COOK, workedMinutes: 0 },
    ],
    shares,
    residueCop: 40000,
    rule: {
      mode: "percentage",
      shares: [{ employeeId: ANA, percent: 60 }, ruleShares[0]],
    },
  });

  shares[0].baseCop = 1;
  ruleShares[0].percent = 1;

  expect(closed.adjustsSettlementId).toBeNull();
  expect(closed.rule).toEqual({
    mode: "percentage",
    shares: [
      { employeeId: ANA, percent: 60 },
      { employeeId: COOK, percent: 40 },
    ],
  });
  expect(closed.shares).toEqual([
    { userId: ANA, baseCop: 60000, residueCop: 0 },
    { userId: COOK, baseCop: 0, residueCop: 0 },
  ]);
  expect(book.settlement(SETTLEMENT_ID)).toEqual(closed);
});

it("given a closed settlement, when an adjustment is appended after a later rule, then the new row keeps adjustsSettlementId and the original rule snapshot", () => {
  const book = TipSettlements.empty();
  const closed = book.close({
    id: SETTLEMENT_ID,
    poolCop: 50000,
    participants: [{ userId: ANA, workedMinutes: 300 }],
    shares: [{ userId: ANA, baseCop: 50000, residueCop: 0 }],
    residueCop: 0,
    rule: { mode: "equal", shares: [] },
  });

  const adjustment = book.adjust({
    id: ADJUSTMENT_ID,
    adjustsSettlementId: SETTLEMENT_ID,
    poolCop: 50000,
    participants: [
      { userId: ANA, workedMinutes: 300 },
      { userId: COOK, workedMinutes: 60 },
    ],
    shares: [
      { userId: ANA, baseCop: 25000, residueCop: 0 },
      { userId: COOK, baseCop: 25000, residueCop: 0 },
    ],
    residueCop: 0,
    rule: { mode: "hours", shares: [] },
  });

  expect(book.settlements).toHaveLength(2);
  expect(adjustment.id).toBe(ADJUSTMENT_ID);
  expect(adjustment.adjustsSettlementId).toBe(SETTLEMENT_ID);
  expect(adjustment.rule).toEqual({ mode: "equal", shares: [] });
  expect(adjustment.shares).toEqual([
    { userId: ANA, baseCop: 25000, residueCop: 0 },
    { userId: COOK, baseCop: 25000, residueCop: 0 },
  ]);
  expect(book.settlement(SETTLEMENT_ID)).toEqual(closed);
});

it("given the same settlement_ id, when the settlement is closed again, then the first row is returned", () => {
  const book = TipSettlements.empty();
  const first = book.close({
    id: SETTLEMENT_ID,
    poolCop: 100000,
    participants: [{ userId: ANA, workedMinutes: 480 }],
    shares: [{ userId: ANA, baseCop: 100000, residueCop: 0 }],
    residueCop: 0,
    rule: { mode: "equal", shares: [] },
  });

  const second = book.close({
    id: SETTLEMENT_ID,
    poolCop: 1,
    participants: [],
    shares: [],
    residueCop: 1,
    rule: { mode: "hours", shares: [] },
  });

  expect(second).toEqual(first);
  expect(book.settlements).toHaveLength(1);
  expect(book.settlement(SETTLEMENT_ID)).toEqual(first);
});

it("given a closed settlement, when a stored share is edited, then the edit is rejected", () => {
  const book = TipSettlements.empty();
  book.close({
    id: SETTLEMENT_ID,
    poolCop: 100000,
    participants: [{ userId: ANA, workedMinutes: 480 }],
    shares: [{ userId: ANA, baseCop: 100000, residueCop: 0 }],
    residueCop: 0,
    rule: { mode: "equal", shares: [] },
  });

  const edit = () => {
    book.editShare(SETTLEMENT_ID, ANA, 1);
  };

  expect(edit).toThrow(TipShareEditRejected);
  expect(book.settlement(SETTLEMENT_ID)?.shares).toEqual([
    { userId: ANA, baseCop: 100000, residueCop: 0 },
  ]);
});
