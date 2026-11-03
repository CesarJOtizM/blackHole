import { expect, it, vi } from "vitest";

import { OpenShift } from "#application/open-shift/open-shift.js";
import { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import {
  type KnownRegister,
  RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import {
  type CashShift,
  InvalidShiftId,
  ShiftAlreadyOpen,
} from "#domain/cash-shift.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const UNKNOWN_REGISTER_ID = "organization_register_missing";
const CASHIER_ID = "user_cashier";
const OTHER_CASHIER_ID = "user_other";
const SHIFT_ID = "shift_front_1";
const OTHER_SHIFT_ID = "shift_front_2";
const OPENING_FLOAT_COP = 200_000;

const registerKey = (
  tenantId: string,
  venueId: string,
  registerId: string,
): string => `${tenantId}:${venueId}:${registerId}`;

class MemoryCashRegister extends CashRegisterRepository {
  private readonly shifts = new Map<string, CashShift>();

  override async load(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<CashShift | null> {
    return this.shifts.get(registerKey(tenantId, venueId, registerId)) ?? null;
  }

  override async save(
    tenantId: string,
    venueId: string,
    shift: CashShift,
  ): Promise<void> {
    this.shifts.set(registerKey(tenantId, venueId, shift.registerId), shift);
  }
}

class MemoryRegisterLookup extends RegisterLookup {
  constructor(private readonly known: ReadonlySet<string>) {
    super();
  }

  override async find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<KnownRegister | null> {
    if (!this.known.has(registerKey(tenantId, venueId, registerId))) {
      return null;
    }

    return { id: registerId, venueId, drawer: "absent", printerId: null };
  }
}

const knownRegisters = new Set([
  registerKey(TENANT_ID, VENUE_ID, REGISTER_ID),
  registerKey(OTHER_TENANT_ID, VENUE_ID, REGISTER_ID),
]);

const openShiftFor = () => {
  const repository = new MemoryCashRegister();
  const lookup = new MemoryRegisterLookup(knownRegisters);

  return {
    repository,
    openShift: new OpenShift(repository, lookup),
  };
};

const openInput = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  shiftId: SHIFT_ID,
  cashierId: CASHIER_ID,
  openingFloatCop: OPENING_FLOAT_COP,
};

it("given cash register C has no open shift, when cashier K declares a 200000 float, then a shift opens for K on C", async () => {
  const { repository, openShift } = openShiftFor();

  const opened = await openShift.execute(openInput);

  expect(opened.id).toBe(SHIFT_ID);
  expect(opened.registerId).toBe(REGISTER_ID);
  expect(opened.cashierId).toBe(CASHIER_ID);
  expect(opened.openingFloatCop).toBe(OPENING_FLOAT_COP);
  expect(opened.state).toBe("open");
  expect(opened.expectedCashCop).toBe(OPENING_FLOAT_COP);
  expect(opened.movements).toEqual([]);
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.id).toBe(SHIFT_ID);
  expect(stored?.cashierId).toBe(CASHIER_ID);
  expect(stored?.openingFloatCop).toBe(OPENING_FLOAT_COP);
  expect(stored?.state).toBe("open");
});

it("given C has an open shift, when another cashier opens a shift on C, then ShiftAlreadyOpen and the first shift stays", async () => {
  const { repository, openShift } = openShiftFor();
  await openShift.execute(openInput);
  const save = vi.spyOn(repository, "save");

  const openAgain = openShift.execute({
    ...openInput,
    shiftId: OTHER_SHIFT_ID,
    cashierId: OTHER_CASHIER_ID,
    openingFloatCop: 50_000,
  });

  await expect(openAgain).rejects.toThrow(ShiftAlreadyOpen);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.id).toBe(SHIFT_ID);
  expect(stored?.cashierId).toBe(CASHIER_ID);
  expect(stored?.openingFloatCop).toBe(OPENING_FLOAT_COP);
  expect(stored?.state).toBe("open");
});

it("given a rejection, when a shift is opened, then it stays unsaved", async () => {
  const { repository, openShift } = openShiftFor();
  const save = vi.spyOn(repository, "save");

  const open = openShift.execute({
    ...openInput,
    shiftId: "front_1",
  });

  await expect(open).rejects.toThrow(InvalidShiftId);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored).toBeNull();
});

it("given an unknown register, when a shift is opened, then UnknownRegister and nothing is saved", async () => {
  const { repository, openShift } = openShiftFor();
  const save = vi.spyOn(repository, "save");

  const open = openShift.execute({
    ...openInput,
    registerId: UNKNOWN_REGISTER_ID,
  });

  await expect(open).rejects.toThrow(UnknownRegister);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(
    TENANT_ID,
    VENUE_ID,
    UNKNOWN_REGISTER_ID,
  );
  expect(stored).toBeNull();
});

it("given a shift saved for one tenant, when another tenant loads that register, then the shift is absent", async () => {
  const { repository, openShift } = openShiftFor();

  await openShift.execute(openInput);

  const otherTenant = await repository.load(
    OTHER_TENANT_ID,
    VENUE_ID,
    REGISTER_ID,
  );
  const sameTenant = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(otherTenant).toBeNull();
  expect(sameTenant?.id).toBe(SHIFT_ID);
});
