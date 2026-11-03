import { expect, it, vi } from "vitest";

import { CloseShift } from "#application/close-shift/close-shift.js";
import { CashCountStore } from "#application/ports/cash-count-store.js";
import { Printer, type SaleReceiptJob } from "#application/ports/printer.js";
import {
  type KnownRegister,
  type RegisterDrawer,
  RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import {
  CashCount,
  CountingRejectsCharges,
  ShiftClosed,
  VarianceNeedsApproval,
} from "#domain/cash-count.js";
import { InvalidMovementId, MissingReason } from "#domain/cash-shift.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const UNKNOWN_REGISTER_ID = "organization_register_missing";
const CASHIER_ID = "user_cashier";
const SUPERVISOR_ID = "user_supervisor";
const COUNT_ID = "count_front_1";
const EXPECTED_CASH_COP = 100_000;
const INSIDE_CAP_COP = 20_000;
const OUTSIDE_CAP_COP = 5_000;
const CORRECTION_ID = "movement_correction_1";
const ORIGINAL_PAYMENT_ID = "payment_original";
const CORRECTION_COP = 4_000;
const CORRECTION_REASON = "Fix a tender";
const JUSTIFICATION = "Drawer was short";
const PRINTER_ID = "printer-front";

interface RegisterProfile {
  drawer: RegisterDrawer;
  printerId: string | null;
}

class MemoryPrinter extends Printer {
  readonly jobs: SaleReceiptJob[] = [];

  override async enqueue(job: SaleReceiptJob): Promise<{
    status: "waiting";
    kickDrawer: boolean;
  }> {
    this.jobs.push(job);

    return { status: "waiting", kickDrawer: job.kickDrawer };
  }
}

const registerKey = (
  tenantId: string,
  venueId: string,
  registerId: string,
): string => `${tenantId}:${venueId}:${registerId}`;

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
  constructor(
    private readonly known: ReadonlySet<string>,
    private readonly profiles: ReadonlyMap<string, RegisterProfile> = new Map(),
  ) {
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

    const profile = this.profiles.get(
      registerKey(tenantId, venueId, registerId),
    );

    return {
      id: registerId,
      venueId,
      drawer: profile?.drawer ?? "absent",
      printerId: profile?.printerId ?? null,
    };
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

const startedCount = () =>
  CashCount.start({ id: COUNT_ID, countedBy: CASHIER_ID });

const submitBalanced = (count: CashCount) => {
  count.submit({
    denominations: [{ denomination: 50_000, quantity: 2 }],
    expectedCashCop: EXPECTED_CASH_COP,
    terminals: [],
  });
};

const submitShort = (count: CashCount) => {
  count.submit({
    denominations: [{ denomination: 10_000, quantity: 9 }],
    expectedCashCop: EXPECTED_CASH_COP,
    terminals: [],
  });
};

const closeFor = async (count?: CashCount, profile?: RegisterProfile) => {
  const counts = new MemoryCashCounts();
  const profiles = new Map<string, RegisterProfile>();

  if (profile) {
    profiles.set(registerKey(TENANT_ID, VENUE_ID, REGISTER_ID), profile);
  }

  const lookup = new MemoryRegisterLookup(knownRegisters, profiles);
  const printer = new MemoryPrinter();

  if (count) {
    await counts.save(TENANT_ID, VENUE_ID, REGISTER_ID, count);
  }

  return {
    counts,
    printer,
    closeShift: new CloseShift(lookup, counts, printer),
  };
};

const figuresOf = (count: CashCount) => ({
  state: count.state,
  expectedCashCop: count.expectedCashCop,
  countedCashCop: count.countedCashCop,
  differenceCop: count.differenceCop,
  denominations: count.denominations,
  terminalDifferences: count.terminalDifferences,
});

it("given a 10000 gap inside varianceCop, when nobody else has approved, then final close throws VarianceNeedsApproval and it stays counting", async () => {
  const count = startedCount();
  submitShort(count);
  const { counts, closeShift } = await closeFor(count);
  const save = vi.spyOn(counts, "save");

  const close = closeShift.final({ ...scope, varianceCop: INSIDE_CAP_COP });

  await expect(close).rejects.toThrow(VarianceNeedsApproval);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
  expect(stored?.differenceCop).toBe(-10_000);
});

it("given an approved gap outside varianceCop, when the cashier final-closes, then VarianceNeedsApproval and it stays counting", async () => {
  const count = startedCount();
  submitShort(count);
  count.approve({ approverId: SUPERVISOR_ID, justification: JUSTIFICATION });
  const { counts, closeShift } = await closeFor(count);
  const save = vi.spyOn(counts, "save");

  const close = closeShift.final({ ...scope, varianceCop: OUTSIDE_CAP_COP });

  await expect(close).rejects.toThrow(VarianceNeedsApproval);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
});

it("given a 10000 gap inside varianceCop approved by another person, when the cashier final-closes, then the shift is closed", async () => {
  const count = startedCount();
  submitShort(count);
  count.approve({ approverId: SUPERVISOR_ID, justification: JUSTIFICATION });
  const { counts, closeShift } = await closeFor(count);

  const closed = await closeShift.final({
    ...scope,
    varianceCop: INSIDE_CAP_COP,
  });

  expect(closed.state).toBe("closed");
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("closed");
  expect(stored?.differenceCop).toBe(-10_000);
});

it("given a count with no gap, when the cashier final-closes, then the shift closes without another person", async () => {
  const count = startedCount();
  submitBalanced(count);
  const { counts, closeShift } = await closeFor(count);

  const closed = await closeShift.final({ ...scope, varianceCop: 0 });

  expect(closed.state).toBe("closed");
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("closed");
  expect(stored?.differenceCop).toBe(0);
});

it("given an open shift, when a partial close is done, then the shift stays open and keeps receiving payments", async () => {
  const { counts, closeShift } = await closeFor();

  const opened = await closeShift.partial({
    ...scope,
    countId: COUNT_ID,
    countedBy: CASHIER_ID,
  });

  expect(opened.state).toBe("open");
  expect(opened.expectedCashCop).toBeUndefined();
  await expect(closeShift.receiveCharge(scope)).resolves.toBeUndefined();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("open");
});

it("given a submitted count, when a partial close is done, then the shift stays open and keeps receiving payments", async () => {
  const count = startedCount();
  submitBalanced(count);
  const { counts, closeShift } = await closeFor(count);

  const opened = await closeShift.partial({
    ...scope,
    countId: COUNT_ID,
    countedBy: CASHIER_ID,
  });

  expect(opened.state).toBe("open");
  await expect(closeShift.receiveCharge(scope)).resolves.toBeUndefined();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("open");
  expect(stored?.expectedCashCop).toBe(EXPECTED_CASH_COP);
});

it("given the shift is counting, when a new charge is recorded, then CountingRejectsCharges and nothing is saved", async () => {
  const count = startedCount();
  submitBalanced(count);
  const { counts, closeShift } = await closeFor(count);
  const save = vi.spyOn(counts, "save");

  const charge = closeShift.receiveCharge(scope);

  await expect(charge).rejects.toThrow(CountingRejectsCharges);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
});

it("given a closed shift, when a payment is added or edited, then ShiftClosed and nothing is saved", async () => {
  const count = startedCount();
  submitBalanced(count);
  count.finalClose();
  const before = figuresOf(count);
  const { counts, closeShift } = await closeFor(count);
  const save = vi.spyOn(counts, "save");

  const edit = closeShift.changePayment(scope);
  const add = closeShift.receiveCharge(scope);

  await expect(edit).rejects.toThrow(ShiftClosed);
  await expect(add).rejects.toThrow(ShiftClosed);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored ? figuresOf(stored) : null).toEqual(before);
  expect(stored?.corrections).toEqual([]);
});

it("given a closed shift, when a correction is recorded, then it is a new movement and the count is not edited", async () => {
  const count = startedCount();
  submitBalanced(count);
  count.finalClose();
  const before = figuresOf(count);
  const { counts, closeShift } = await closeFor(count);

  const corrected = await closeShift.correct({
    ...scope,
    movementId: CORRECTION_ID,
    referencesId: ORIGINAL_PAYMENT_ID,
    amountCop: CORRECTION_COP,
    reason: CORRECTION_REASON,
  });

  expect(corrected.corrections).toEqual([
    {
      id: CORRECTION_ID,
      referencesId: ORIGINAL_PAYMENT_ID,
      amountCop: CORRECTION_COP,
      reason: CORRECTION_REASON,
    },
  ]);
  expect(figuresOf(corrected)).toEqual(before);
  expect(corrected.state).toBe("closed");
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.corrections).toEqual(corrected.corrections);
  expect(stored ? figuresOf(stored) : null).toEqual(before);
});

it("given a closed shift, when a correction has an empty reason, then MissingReason and nothing is saved", async () => {
  const count = startedCount();
  submitBalanced(count);
  count.finalClose();
  const { counts, closeShift } = await closeFor(count);
  const save = vi.spyOn(counts, "save");

  const correct = closeShift.correct({
    ...scope,
    movementId: CORRECTION_ID,
    referencesId: ORIGINAL_PAYMENT_ID,
    amountCop: CORRECTION_COP,
    reason: "  ",
  });

  await expect(correct).rejects.toThrow(MissingReason);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.corrections).toEqual([]);
  expect(stored?.state).toBe("closed");
});

it("given a correction id without the movement_ prefix, when it is recorded, then InvalidMovementId and nothing is saved", async () => {
  const count = startedCount();
  submitBalanced(count);
  count.finalClose();
  const { counts, closeShift } = await closeFor(count);
  const save = vi.spyOn(counts, "save");

  const correct = closeShift.correct({
    ...scope,
    movementId: "correction_1",
    referencesId: ORIGINAL_PAYMENT_ID,
    amountCop: CORRECTION_COP,
    reason: CORRECTION_REASON,
  });

  await expect(correct).rejects.toThrow(InvalidMovementId);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.corrections).toEqual([]);
});

it("given an unknown register, when the shift is final-closed, then UnknownRegister and nothing is saved", async () => {
  const count = startedCount();
  submitBalanced(count);
  const { counts, closeShift } = await closeFor(count);
  const save = vi.spyOn(counts, "save");

  const close = closeShift.final({
    ...scope,
    registerId: UNKNOWN_REGISTER_ID,
    varianceCop: 0,
  });

  await expect(close).rejects.toThrow(UnknownRegister);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
});

it("given a count saved for one tenant, when another tenant final-closes, then the first count stays counting", async () => {
  const count = startedCount();
  submitBalanced(count);
  const { counts, closeShift } = await closeFor(count);
  const save = vi.spyOn(counts, "save");

  const close = closeShift.final({
    ...scope,
    tenantId: OTHER_TENANT_ID,
    varianceCop: 0,
  });

  await expect(close).rejects.toThrow(VarianceNeedsApproval);
  expect(save).not.toHaveBeenCalled();
  expect(await counts.find(OTHER_TENANT_ID, VENUE_ID, REGISTER_ID)).toBeNull();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
});

it.each([
  ["a present", "present"],
  ["an absent", "absent"],
] as const)(
  "given %s drawer and a printer, when the shift is final-closed, then cash_close is enqueued once with kickDrawer false and the drawer is not opened",
  async (_article, drawer) => {
    const count = startedCount();
    submitBalanced(count);
    const { counts, printer, closeShift } = await closeFor(count, {
      drawer,
      printerId: PRINTER_ID,
    });
    const save = vi.spyOn(counts, "save");
    const enqueue = vi.spyOn(printer, "enqueue");

    await closeShift.final({ ...scope, varianceCop: 0 });
    const again = closeShift.final({ ...scope, varianceCop: 0 });

    await expect(again).rejects.toThrow(ShiftClosed);
    expect(printer.jobs).toEqual([
      {
        commandId: COUNT_ID,
        printerId: PRINTER_ID,
        document: "cash_close",
        kickDrawer: false,
      },
    ]);
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(
      enqueue.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(JSON.stringify(printer.jobs)).not.toContain("cash.drawer-opened");
    expect(JSON.stringify(printer.jobs)).not.toContain("1B 70");
    expect(JSON.stringify(printer.jobs)).not.toContain("\\u001b");
    expect(Object.getOwnPropertyNames(CloseShift.prototype)).not.toContain(
      "openDrawer",
    );
  },
);

it("given a present drawer and no printer, when the shift is final-closed, then cash_close is not enqueued", async () => {
  const count = startedCount();
  submitBalanced(count);
  const { printer, closeShift } = await closeFor(count, {
    drawer: "present",
    printerId: null,
  });

  await closeShift.final({ ...scope, varianceCop: 0 });

  expect(printer.jobs).toEqual([]);
});

it("given a present drawer and a printer, when final close is rejected, then cash_close is not enqueued", async () => {
  const count = startedCount();
  submitShort(count);
  const { printer, closeShift } = await closeFor(count, {
    drawer: "present",
    printerId: PRINTER_ID,
  });

  const close = closeShift.final({ ...scope, varianceCop: INSIDE_CAP_COP });

  await expect(close).rejects.toThrow(VarianceNeedsApproval);
  expect(printer.jobs).toEqual([]);
});

it("given a present drawer and a printer, when the close is partial, then cash_close is not enqueued", async () => {
  const { printer, closeShift } = await closeFor(undefined, {
    drawer: "present",
    printerId: PRINTER_ID,
  });

  await closeShift.partial({
    ...scope,
    countId: COUNT_ID,
    countedBy: CASHIER_ID,
  });

  expect(printer.jobs).toEqual([]);
});
