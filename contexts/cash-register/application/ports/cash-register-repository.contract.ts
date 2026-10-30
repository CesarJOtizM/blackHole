import { expect, it } from "vitest";

import type { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import {
  type CashMovementKind,
  CashShift,
  ShiftAlreadyOpen,
} from "#domain/cash-shift.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const REGISTER_ID = "organization_register_front";
const OTHER_REGISTER_ID = "organization_register_bar";
const CASHIER_ID = "user_cashier";
const OTHER_CASHIER_ID = "user_other";
const SHIFT_ID = "shift_front_1";
const OTHER_SHIFT_ID = "shift_front_2";
const BAR_SHIFT_ID = "shift_bar_1";
const SITE_SHIFT_ID = "shift_front_site";
const OPENING_FLOAT_COP = 200_000;
const OTHER_FLOAT_COP = 50_000;

const openShift = (input: {
  registerId: string;
  id: string;
  cashierId: string;
  openingFloatCop: number;
  movement?: {
    id: string;
    kind: CashMovementKind;
    amountCop: number;
    reason: string;
  };
}): CashShift => {
  const shift = CashShift.forRegister(input.registerId);
  shift.open({
    id: input.id,
    cashierId: input.cashierId,
    openingFloatCop: input.openingFloatCop,
  });

  if (input.movement) {
    shift.recordMovement(input.movement);
  }

  return shift;
};

const frontShift = (): CashShift =>
  openShift({
    registerId: REGISTER_ID,
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
    movement: {
      id: "movement_safe_1",
      kind: "withdrawal",
      amountCop: 300_000,
      reason: "Safe drop",
    },
  });

export function cashRegisterRepositoryContract(
  createRepository: () =>
    | CashRegisterRepository
    | Promise<CashRegisterRepository>,
): void {
  it("given an open shift with a movement, when it is saved, then the same id, cashier, float, and movements load back", async () => {
    const repository = await createRepository();
    const shift = frontShift();

    await repository.save(TENANT_A, VENUE_ID, shift);

    const stored = await repository.load(TENANT_A, VENUE_ID, REGISTER_ID);
    expect(stored).toBeInstanceOf(CashShift);
    expect(stored).not.toBe(shift);
    expect(stored?.id).toBe(SHIFT_ID);
    expect(stored?.cashierId).toBe(CASHIER_ID);
    expect(stored?.openingFloatCop).toBe(OPENING_FLOAT_COP);
    expect(stored?.registerId).toBe(REGISTER_ID);
    expect(stored?.state).toBe("open");
    expect(stored?.movements).toEqual(shift.movements);
  });

  it("given tenant A saved a shift, when tenant B loads that register, then A's shift stays hidden", async () => {
    const repository = await createRepository();
    const shiftA = frontShift();
    const shiftB = openShift({
      registerId: REGISTER_ID,
      id: OTHER_SHIFT_ID,
      cashierId: OTHER_CASHIER_ID,
      openingFloatCop: OTHER_FLOAT_COP,
    });

    await repository.save(TENANT_A, VENUE_ID, shiftA);

    expect(await repository.load(TENANT_B, VENUE_ID, REGISTER_ID)).toBeNull();

    await repository.save(TENANT_B, VENUE_ID, shiftB);

    const loadedA = await repository.load(TENANT_A, VENUE_ID, REGISTER_ID);
    const loadedB = await repository.load(TENANT_B, VENUE_ID, REGISTER_ID);
    expect(loadedA?.id).toBe(SHIFT_ID);
    expect(loadedA?.cashierId).toBe(CASHIER_ID);
    expect(loadedA?.openingFloatCop).toBe(OPENING_FLOAT_COP);
    expect(loadedA?.movements).toEqual(shiftA.movements);
    expect(loadedB?.id).toBe(OTHER_SHIFT_ID);
    expect(loadedB?.cashierId).toBe(OTHER_CASHIER_ID);
    expect(loadedB?.openingFloatCop).toBe(OTHER_FLOAT_COP);
    expect(loadedB?.movements).toEqual([]);
  });

  it("given an open shift on a register, when a different open shift is saved on that register, then the save is rejected and the first shift stays", async () => {
    const repository = await createRepository();
    const first = frontShift();
    const otherRegister = openShift({
      registerId: OTHER_REGISTER_ID,
      id: BAR_SHIFT_ID,
      cashierId: OTHER_CASHIER_ID,
      openingFloatCop: OTHER_FLOAT_COP,
    });
    const otherVenue = openShift({
      registerId: REGISTER_ID,
      id: SITE_SHIFT_ID,
      cashierId: OTHER_CASHIER_ID,
      openingFloatCop: OTHER_FLOAT_COP,
    });
    const second = openShift({
      registerId: REGISTER_ID,
      id: OTHER_SHIFT_ID,
      cashierId: OTHER_CASHIER_ID,
      openingFloatCop: OTHER_FLOAT_COP,
    });

    await repository.save(TENANT_A, VENUE_ID, first);
    await repository.save(TENANT_A, VENUE_ID, otherRegister);
    await repository.save(TENANT_A, OTHER_VENUE_ID, otherVenue);

    await expect(
      repository.save(TENANT_A, VENUE_ID, second),
    ).rejects.toBeInstanceOf(ShiftAlreadyOpen);

    const stored = await repository.load(TENANT_A, VENUE_ID, REGISTER_ID);
    expect(stored?.id).toBe(SHIFT_ID);
    expect(stored?.cashierId).toBe(CASHIER_ID);
    expect(stored?.openingFloatCop).toBe(OPENING_FLOAT_COP);
    expect(stored?.movements).toEqual(first.movements);
    expect(
      (await repository.load(TENANT_A, VENUE_ID, OTHER_REGISTER_ID))?.id,
    ).toBe(BAR_SHIFT_ID);
    expect(
      (await repository.load(TENANT_A, OTHER_VENUE_ID, REGISTER_ID))?.id,
    ).toBe(SITE_SHIFT_ID);
  });

  it("given a cash register repository, when the instance is inspected, then it has no update method and no delete method", async () => {
    const repository = await createRepository();

    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });
}
