import { expect, it } from "vitest";

import { CashShift, ShiftAlreadyOpen } from "#domain/cash-shift.js";

const REGISTER_ID = "organization_register_front";
const CASHIER_ID = "user_cashier";
const OTHER_CASHIER_ID = "user_other";
const SHIFT_ID = "shift_front_1";
const OTHER_SHIFT_ID = "shift_front_2";
const OPENING_FLOAT_COP = 200_000;

const shiftOnFront = () => CashShift.forRegister(REGISTER_ID);

const viewOf = (shift: CashShift) => ({
  id: shift.id,
  registerId: shift.registerId,
  cashierId: shift.cashierId,
  openingFloatCop: shift.openingFloatCop,
  state: shift.state,
});

it("given cash register C has no open shift, when cashier K declares a 200000 float, then a shift opens for K on C", () => {
  const shift = shiftOnFront();

  shift.open({
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
  });

  expect(viewOf(shift)).toEqual({
    id: SHIFT_ID,
    registerId: REGISTER_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
    state: "open",
  });
});

it("given C has an open shift, when another cashier opens a shift on C, then ShiftAlreadyOpen and the shift stays", () => {
  const shift = shiftOnFront();
  shift.open({
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
  });
  const before = viewOf(shift);

  const openAgain = () => {
    shift.open({
      id: OTHER_SHIFT_ID,
      cashierId: OTHER_CASHIER_ID,
      openingFloatCop: 50_000,
    });
  };

  expect(openAgain).toThrow(ShiftAlreadyOpen);
  expect(viewOf(shift)).toEqual(before);
});
