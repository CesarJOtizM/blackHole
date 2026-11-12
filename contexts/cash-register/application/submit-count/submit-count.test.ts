import { expect, it, vi } from "vitest";
import { ScriptedPaymentGateway } from "#adapters/memory/scripted-payment-gateway.js";
import { CashCountStore } from "#application/ports/cash-count-store.js";
import { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import {
  type KnownRegister,
  RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { OpenShiftRequired } from "#application/record-movement/record-movement.js";
import {
  RecountRejected,
  SubmitCount,
} from "#application/submit-count/submit-count.js";
import {
  type CashCount,
  InvalidCountId,
  ShiftClosed,
  VarianceNeedsApproval,
} from "#domain/cash-count.js";
import { CashShift, InvalidCashAmount } from "#domain/cash-shift.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const UNKNOWN_REGISTER_ID = "organization_register_missing";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const SHIFT_ID = "shift_front_1";
const COUNT_ID = "count_front_1";
const EXPECTED_CASH_COP = 100_000;
const TERMINAL_ID = "T";
const RECORDED_COP = 900_000;
const REPORTED_COP = 880_000;
const TERMINAL_GAP_COP = 20_000;

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

class MemoryCashCounts extends CashCountStore {
  private readonly counts = new Map<string, CashCount>();

  override async find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<CashCount | null> {
    return this.counts.get(registerKey(tenantId, venueId, registerId)) ?? null;
  }

  override async save(
    tenantId: string,
    venueId: string,
    registerId: string,
    count: CashCount,
  ): Promise<void> {
    this.counts.set(registerKey(tenantId, venueId, registerId), count);
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

const scope = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
};

const shortDenominations = [{ denomination: 10_000 as const, quantity: 9 }];
const lowerDenominations = [{ denomination: 10_000 as const, quantity: 8 }];
const balancedDenominations = [{ denomination: 50_000 as const, quantity: 2 }];

const submitInput = {
  ...scope,
  countId: COUNT_ID,
  countedBy: CASHIER_ID,
  denominations: shortDenominations,
  terminals: [],
};

const countFor = async (openedShift = true) => {
  const registers = new MemoryCashRegister();
  const counts = new MemoryCashCounts();
  const lookup = new MemoryRegisterLookup(knownRegisters);

  if (openedShift) {
    const shift = CashShift.forRegister(REGISTER_ID);
    shift.open({
      id: SHIFT_ID,
      cashierId: CASHIER_ID,
      openingFloatCop: EXPECTED_CASH_COP,
    });
    await registers.save(TENANT_ID, VENUE_ID, shift);
  }

  return {
    registers,
    counts,
    submitCount: new SubmitCount(lookup, registers, counts),
  };
};

it("given the cashier has not submitted, when the count is read, then no expected total is shown", async () => {
  const { registers, counts, submitCount } = await countFor();

  const reading = await submitCount.read(scope);

  const shift = await registers.load(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(shift?.expectedCashCop).toBe(EXPECTED_CASH_COP);
  expect(reading).toEqual({
    state: "open",
    expectedCashCop: undefined,
    countedCashCop: undefined,
    differenceCop: undefined,
  });
  expect(await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID)).toBeNull();
});

it("given a 10000 short count, when the cashier submits, then the count is stored and the read shows the expected total", async () => {
  const { counts, submitCount } = await countFor();

  const submitted = await submitCount.execute(submitInput);

  expect(submitted.id).toBe(COUNT_ID);
  expect(submitted.countedBy).toBe(CASHIER_ID);
  expect(submitted.state).toBe("counting");
  expect(submitted.expectedCashCop).toBe(EXPECTED_CASH_COP);
  expect(submitted.countedCashCop).toBe(90_000);
  expect(submitted.differenceCop).toBe(-10_000);
  expect(submitted.denominations).toEqual(shortDenominations);
  expect(await submitCount.read(scope)).toEqual({
    state: "counting",
    expectedCashCop: EXPECTED_CASH_COP,
    countedCashCop: 90_000,
    differenceCop: -10_000,
  });
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.expectedCashCop).toBe(EXPECTED_CASH_COP);
  expect(stored?.state).toBe("counting");
});

it("given terminal T recorded 900000 and its report says 880000, when the count is submitted, then a 20000 difference is stored for T", async () => {
  const { counts, submitCount } = await countFor();

  const submitted = await submitCount.execute({
    ...submitInput,
    denominations: balancedDenominations,
    terminals: [
      {
        terminalId: TERMINAL_ID,
        recordedCop: RECORDED_COP,
        reportedCop: REPORTED_COP,
      },
    ],
  });

  expect(submitted.differenceCop).toBe(0);
  expect(submitted.terminalDifferences).toEqual([
    { terminalId: TERMINAL_ID, differenceCop: TERMINAL_GAP_COP },
  ]);
  expect(submitted.state).toBe("counting");
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.terminalDifferences).toEqual([
    { terminalId: TERMINAL_ID, differenceCop: TERMINAL_GAP_COP },
  ]);
});

it("given a counted shift, when the cashier recounts while it is counting, then the new count is stored and still needs approval", async () => {
  const { counts, submitCount } = await countFor();
  const submitted = await submitCount.execute(submitInput);
  submitted.approve({
    approverId: SUPERVISOR_ID,
    justification: "Drawer was short",
  });

  const recounted = await submitCount.execute({
    ...submitInput,
    denominations: lowerDenominations,
  });

  expect(recounted.state).toBe("counting");
  expect(recounted.countedCashCop).toBe(80_000);
  expect(recounted.differenceCop).toBe(-20_000);
  expect(() => recounted.finalClose()).toThrow(VarianceNeedsApproval);
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.countedCashCop).toBe(80_000);
  expect(stored?.state).toBe("counting");
});

it("given a partial close, when the cashier recounts, then RecountRejected and nothing is saved", async () => {
  const { counts, submitCount } = await countFor();
  const submitted = await submitCount.execute(submitInput);
  submitted.partialClose();
  const save = vi.spyOn(counts, "save");

  const recount = submitCount.execute({
    ...submitInput,
    denominations: lowerDenominations,
  });

  await expect(recount).rejects.toThrow(RecountRejected);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("open");
  expect(stored?.countedCashCop).toBe(90_000);
  expect(stored?.expectedCashCop).toBe(EXPECTED_CASH_COP);
});

it("given a closed shift, when the cashier recounts, then ShiftClosed and nothing is saved", async () => {
  const { counts, submitCount } = await countFor();
  const submitted = await submitCount.execute({
    ...submitInput,
    denominations: balancedDenominations,
  });
  submitted.finalClose();
  const save = vi.spyOn(counts, "save");

  const recount = submitCount.execute({
    ...submitInput,
    denominations: lowerDenominations,
  });

  await expect(recount).rejects.toThrow(ShiftClosed);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("closed");
  expect(stored?.countedCashCop).toBe(EXPECTED_CASH_COP);
});

it("given an unknown register, when the cashier submits, then UnknownRegister and nothing is saved", async () => {
  const { counts, submitCount } = await countFor();
  const save = vi.spyOn(counts, "save");

  const submit = submitCount.execute({
    ...submitInput,
    registerId: UNKNOWN_REGISTER_ID,
  });

  await expect(submit).rejects.toThrow(UnknownRegister);
  expect(save).not.toHaveBeenCalled();
  expect(
    await counts.find(TENANT_ID, VENUE_ID, UNKNOWN_REGISTER_ID),
  ).toBeNull();
});

it("given a count id without the count_ prefix, when the cashier submits, then InvalidCountId and nothing is saved", async () => {
  const { counts, submitCount } = await countFor();
  const save = vi.spyOn(counts, "save");

  const submit = submitCount.execute({
    ...submitInput,
    countId: "front_1",
  });

  await expect(submit).rejects.toThrow(InvalidCountId);
  expect(save).not.toHaveBeenCalled();
  expect(await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID)).toBeNull();
});

it("given a fractional COP quantity, when the cashier submits, then InvalidCashAmount and no expected total is stored", async () => {
  const { counts, submitCount } = await countFor();
  const save = vi.spyOn(counts, "save");

  const submit = submitCount.execute({
    ...submitInput,
    denominations: [{ denomination: 50_000, quantity: 1.5 }],
  });

  await expect(submit).rejects.toThrow(InvalidCashAmount);
  expect(save).not.toHaveBeenCalled();
  expect(await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID)).toBeNull();
  expect(await submitCount.read(scope)).toEqual({
    state: "open",
    expectedCashCop: undefined,
    countedCashCop: undefined,
    differenceCop: undefined,
  });
});

it("given no open shift, when the cashier submits, then OpenShiftRequired and nothing is saved", async () => {
  const { counts, submitCount } = await countFor(false);
  const save = vi.spyOn(counts, "save");

  const submit = submitCount.execute(submitInput);

  await expect(submit).rejects.toThrow(OpenShiftRequired);
  expect(save).not.toHaveBeenCalled();
  expect(await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID)).toBeNull();
});

it("given a count saved for one tenant, when another tenant reads that register, then the count is absent", async () => {
  const { counts, submitCount } = await countFor();

  await submitCount.execute(submitInput);

  expect(await counts.find(OTHER_TENANT_ID, VENUE_ID, REGISTER_ID)).toBeNull();
  expect(
    await submitCount.read({ ...scope, tenantId: OTHER_TENANT_ID }),
  ).toEqual({
    state: "open",
    expectedCashCop: undefined,
    countedCashCop: undefined,
    differenceCop: undefined,
  });
  expect(
    (await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID))?.expectedCashCop,
  ).toBe(EXPECTED_CASH_COP);
});

it("given a shift with 300000 cash and 120000 qr, when the cashier submits the blind count, then expected cash stays 300000 and qr is shown against the report", async () => {
  const registers = new MemoryCashRegister();
  const counts = new MemoryCashCounts();
  const lookup = new MemoryRegisterLookup(knownRegisters);
  const gateway = new ScriptedPaymentGateway();
  gateway.reportRows = [{ reference: "qrpay_front", amountCop: 120_000 }];
  const shift = CashShift.forRegister(REGISTER_ID);
  shift.open({
    id: SHIFT_ID,
    cashierId: CASHIER_ID,
    openingFloatCop: 300_000,
  });
  shift.recordPayment({
    id: "payment_qr_front",
    originalPaymentId: "payment_qr_front",
    method: "qr",
    amountCop: 120_000,
  });
  await registers.save(TENANT_ID, VENUE_ID, shift);
  const submitCount = new SubmitCount(lookup, registers, counts, gateway);

  const submitted = await submitCount.execute({
    ...submitInput,
    denominations: [{ denomination: 50_000, quantity: 6 }],
  });

  expect(submitted.expectedCashCop).toBe(300_000);
  expect(submitted.differenceCop).toBe(0);
  expect(submitted.qrCop).toBe(120_000);
  expect(submitted.qrReportCop).toBe(120_000);
  expect(await submitCount.read(scope)).toEqual({
    state: "counting",
    expectedCashCop: 300_000,
    countedCashCop: 300_000,
    differenceCop: 0,
    qrCop: 120_000,
    qrReportCop: 120_000,
  });
});
