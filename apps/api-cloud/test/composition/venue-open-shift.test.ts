import { InMemoryCashRegisterRepository } from "@blackhole/cash-register/adapters/memory/in-memory-cash-register-repository";
import { CashShift } from "@blackhole/cash-register/domain";
import { expect, it } from "vitest";
import { VenueOpenShift } from "#src/composition/reporting-facts.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const OPENED_AT = "2026-11-11T18:00:00.000Z";

it("given an open cash shift, when a report asks for the venue, then the open shift is the window", async () => {
  const registers = new InMemoryCashRegisterRepository();
  const shift = CashShift.forRegister("organization_register_front");

  shift.open({
    id: "shift_front_1",
    cashierId: "user_cashier",
    openingFloatCop: 200_000,
    openedAt: OPENED_AT,
  });
  await registers.save(TENANT_ID, VENUE_ID, shift);

  expect(
    await new VenueOpenShift(registers).findOpen(TENANT_ID, VENUE_ID),
  ).toEqual({
    shiftId: "shift_front_1",
    openedAt: OPENED_AT,
    closedAt: null,
  });
});

it("given no open cash shift, when a report asks for the venue, then there is no window", async () => {
  const registers = new InMemoryCashRegisterRepository();

  expect(
    await new VenueOpenShift(registers).findOpen(TENANT_ID, VENUE_ID),
  ).toBeNull();
});
