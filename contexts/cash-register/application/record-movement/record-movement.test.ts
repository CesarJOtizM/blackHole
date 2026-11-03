import { expect, it, vi } from "vitest";

import { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import {
  type KnownRegister,
  RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { RecordMovement } from "#application/record-movement/record-movement.js";
import {
  CashShift,
  InvalidMovementId,
  MissingReason,
} from "#domain/cash-shift.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const UNKNOWN_REGISTER_ID = "organization_register_missing";
const CASHIER_ID = "user_cashier";
const SHIFT_ID = "shift_front_1";
const OPENING_FLOAT_COP = 200_000;
const WITHDRAWAL_ID = "movement_safe_1";
const WITHDRAWAL_COP = 300_000;
const WITHDRAWAL_REASON = "Safe drop";
const CASH_OUT_ID = "movement_out_1";
const CASH_OUT_COP = 50_000;

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

const movementFor = () => {
  const repository = new MemoryCashRegister();
  const lookup = new MemoryRegisterLookup(knownRegisters);

  return {
    repository,
    recordMovement: new RecordMovement(repository, lookup),
  };
};

const seedOpenShift = async (
  repository: MemoryCashRegister,
  tenantId: string,
): Promise<CashShift> => {
  const shift = CashShift.forRegister(REGISTER_ID);
  shift.open({
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: OPENING_FLOAT_COP,
  });
  await repository.save(tenantId, VENUE_ID, shift);

  return shift;
};

const withdrawal = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  movementId: WITHDRAWAL_ID,
  kind: "withdrawal" as const,
  amountCop: WITHDRAWAL_COP,
  reason: WITHDRAWAL_REASON,
};

it("given an open shift, when 300000 is withdrawn with a reason, then expected cash drops by 300000", async () => {
  const { repository, recordMovement } = movementFor();
  await seedOpenShift(repository, TENANT_ID);

  const recorded = await recordMovement.execute(withdrawal);

  expect(recorded.expectedCashCop).toBe(OPENING_FLOAT_COP - WITHDRAWAL_COP);
  expect(recorded.movements).toEqual([
    {
      id: WITHDRAWAL_ID,
      kind: "withdrawal",
      amountCop: WITHDRAWAL_COP,
      reason: WITHDRAWAL_REASON,
    },
  ]);
  expect(recorded.openingFloatCop).toBe(OPENING_FLOAT_COP);
  expect(recorded.state).toBe("open");
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.expectedCashCop).toBe(OPENING_FLOAT_COP - WITHDRAWAL_COP);
  expect(stored?.movements).toEqual(recorded.movements);
});

it("given an open shift, when a cash out has no reason, then MissingReason and the shift stays", async () => {
  const { repository, recordMovement } = movementFor();
  await seedOpenShift(repository, TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const recordCashOut = recordMovement.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    registerId: REGISTER_ID,
    movementId: CASH_OUT_ID,
    kind: "cash_out",
    amountCop: CASH_OUT_COP,
    reason: "",
  });

  await expect(recordCashOut).rejects.toThrow(MissingReason);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.expectedCashCop).toBe(OPENING_FLOAT_COP);
  expect(stored?.movements).toEqual([]);
  expect(stored?.state).toBe("open");
});

it("given a rejection, when a movement is recorded, then it stays unsaved", async () => {
  const { repository, recordMovement } = movementFor();
  await seedOpenShift(repository, TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const record = recordMovement.execute({
    ...withdrawal,
    movementId: "safe_1",
  });

  await expect(record).rejects.toThrow(InvalidMovementId);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.movements).toEqual([]);
  expect(stored?.expectedCashCop).toBe(OPENING_FLOAT_COP);
});

it("given an unknown register, when a movement is recorded, then UnknownRegister and nothing is saved", async () => {
  const { repository, recordMovement } = movementFor();
  await seedOpenShift(repository, TENANT_ID);
  const save = vi.spyOn(repository, "save");

  const record = recordMovement.execute({
    ...withdrawal,
    registerId: UNKNOWN_REGISTER_ID,
  });

  await expect(record).rejects.toThrow(UnknownRegister);
  expect(save).not.toHaveBeenCalled();
  const stored = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.movements).toEqual([]);
  expect(stored?.expectedCashCop).toBe(OPENING_FLOAT_COP);
});

it("given a movement saved for one tenant, when another tenant loads that register, then the shift is absent", async () => {
  const { repository, recordMovement } = movementFor();
  await seedOpenShift(repository, TENANT_ID);

  await recordMovement.execute(withdrawal);

  const otherTenant = await repository.load(
    OTHER_TENANT_ID,
    VENUE_ID,
    REGISTER_ID,
  );
  const sameTenant = await repository.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(otherTenant).toBeNull();
  expect(sameTenant?.expectedCashCop).toBe(OPENING_FLOAT_COP - WITHDRAWAL_COP);
});
