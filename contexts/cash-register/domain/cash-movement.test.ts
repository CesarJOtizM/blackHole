import { expect, it } from "vitest";

import { CashShift, MissingReason } from "#domain/cash-shift.js";

const REGISTER_ID = "organization_register_front";
const CASHIER_ID = "user_cashier";
const SHIFT_ID = "shift_front_1";
const OPENING_FLOAT_COP = 200_000;
const WITHDRAWAL_ID = "movement_safe_1";
const WITHDRAWAL_COP = 300_000;
const WITHDRAWAL_REASON = "Safe drop";
const CASH_OUT_ID = "movement_out_1";
const CASH_OUT_COP = 50_000;

const shiftOnFront = () => CashShift.forRegister(REGISTER_ID);

const viewOf = (shift: CashShift) => ({
  id: shift.id,
  registerId: shift.registerId,
  cashierId: shift.cashierId,
  openingFloatCop: shift.openingFloatCop,
  state: shift.state,
  movements: shift.movements,
  expectedCashCop: shift.expectedCashCop,
});

it("given an open shift, when 300000 is withdrawn with a reason, then expected cash drops by 300000", () => {
  const shift = shiftOnFront();
  shift.open({
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
  });

  shift.recordMovement({
    id: WITHDRAWAL_ID,
    kind: "withdrawal",
    amountCop: WITHDRAWAL_COP,
    reason: WITHDRAWAL_REASON,
  });

  expect(shift.expectedCashCop).toBe(OPENING_FLOAT_COP - WITHDRAWAL_COP);
  expect(shift.movements).toEqual([
    {
      id: WITHDRAWAL_ID,
      kind: "withdrawal",
      amountCop: WITHDRAWAL_COP,
      reason: WITHDRAWAL_REASON,
    },
  ]);
  expect(shift.openingFloatCop).toBe(OPENING_FLOAT_COP);
  expect(shift.state).toBe("open");
});

it("given an open shift, when a cash out has no reason, then MissingReason and the shift stays", () => {
  const shift = shiftOnFront();
  shift.open({
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
  });
  const before = viewOf(shift);

  const recordCashOut = () => {
    shift.recordMovement({
      id: CASH_OUT_ID,
      kind: "cash_out",
      amountCop: CASH_OUT_COP,
      reason: "",
    });
  };

  expect(recordCashOut).toThrow(MissingReason);
  expect(viewOf(shift)).toEqual(before);
});
