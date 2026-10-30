import { expect, it, vi } from "vitest";

import { ApproveVariance } from "#application/approve-variance/approve-variance.js";
import { CashCountStore } from "#application/ports/cash-count-store.js";
import {
  type KnownRegister,
  RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import {
  CashCount,
  SelfApprovalRejected,
  VarianceNeedsApproval,
} from "#domain/cash-count.js";

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
const TERMINAL_ID = "T";
const JUSTIFICATION = "Drawer was short";

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

    return { id: registerId, venueId };
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

const shortCount = () => {
  const count = CashCount.start({ id: COUNT_ID, countedBy: CASHIER_ID });
  count.submit({
    denominations: [{ denomination: 10_000, quantity: 9 }],
    expectedCashCop: EXPECTED_CASH_COP,
    terminals: [],
  });
  return count;
};

const terminalCount = () => {
  const count = CashCount.start({ id: COUNT_ID, countedBy: CASHIER_ID });
  count.submit({
    denominations: [{ denomination: 50_000, quantity: 2 }],
    expectedCashCop: EXPECTED_CASH_COP,
    terminals: [
      {
        terminalId: TERMINAL_ID,
        recordedCop: 900_000,
        reportedCop: 880_000,
      },
    ],
  });
  return count;
};

const approveFor = async (count: CashCount) => {
  const counts = new MemoryCashCounts();
  const lookup = new MemoryRegisterLookup(knownRegisters);
  await counts.save(TENANT_ID, VENUE_ID, REGISTER_ID, count);

  return {
    counts,
    approve: new ApproveVariance(lookup, counts),
  };
};

it("given a 10000 gap inside varianceCop, when the cashier approves their own count, then SelfApprovalRejected and nothing is saved", async () => {
  const { counts, approve } = await approveFor(shortCount());
  const save = vi.spyOn(counts, "save");

  const decision = approve.execute({
    ...scope,
    approverId: CASHIER_ID,
    justification: JUSTIFICATION,
    varianceCop: INSIDE_CAP_COP,
  });

  await expect(decision).rejects.toThrow(SelfApprovalRejected);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
  expect(() => stored?.finalClose()).toThrow(VarianceNeedsApproval);
});

it("given a 10000 gap inside varianceCop, when another person approves with a reason, then it stays counting", async () => {
  const { counts, approve } = await approveFor(shortCount());

  const approved = await approve.execute({
    ...scope,
    approverId: SUPERVISOR_ID,
    justification: JUSTIFICATION,
    varianceCop: INSIDE_CAP_COP,
  });

  expect(approved.state).toBe("counting");
  expect(approved.differenceCop).toBe(-10_000);
  approved.finalClose();
  expect(approved.state).toBe("closed");
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("closed");
});

it("given a 10000 gap outside varianceCop, when another person approves, then VarianceNeedsApproval and nothing is saved", async () => {
  const { counts, approve } = await approveFor(shortCount());
  const save = vi.spyOn(counts, "save");

  const decision = approve.execute({
    ...scope,
    approverId: SUPERVISOR_ID,
    justification: JUSTIFICATION,
    varianceCop: OUTSIDE_CAP_COP,
  });

  await expect(decision).rejects.toThrow(VarianceNeedsApproval);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
  expect(() => stored?.finalClose()).toThrow(VarianceNeedsApproval);
});

it("given a gap inside varianceCop, when another person approves without a reason, then VarianceNeedsApproval and nothing is saved", async () => {
  const { counts, approve } = await approveFor(shortCount());
  const save = vi.spyOn(counts, "save");

  const decision = approve.execute({
    ...scope,
    approverId: SUPERVISOR_ID,
    justification: "  ",
    varianceCop: INSIDE_CAP_COP,
  });

  await expect(decision).rejects.toThrow(VarianceNeedsApproval);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
});

it("given terminal T differs by 20000 inside varianceCop, when another person approves, then it stays counting until that approval is stored", async () => {
  const { counts, approve } = await approveFor(terminalCount());

  const approved = await approve.execute({
    ...scope,
    approverId: SUPERVISOR_ID,
    justification: JUSTIFICATION,
    varianceCop: 20_000,
  });

  expect(approved.state).toBe("counting");
  expect(approved.differenceCop).toBe(0);
  expect(approved.terminalDifferences).toEqual([
    { terminalId: TERMINAL_ID, differenceCop: 20_000 },
  ]);
  approved.finalClose();
  expect(approved.state).toBe("closed");
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("closed");
});

it("given terminal T differs by 20000 outside varianceCop, when another person approves, then VarianceNeedsApproval and nothing is saved", async () => {
  const { counts, approve } = await approveFor(terminalCount());
  const save = vi.spyOn(counts, "save");

  const decision = approve.execute({
    ...scope,
    approverId: SUPERVISOR_ID,
    justification: JUSTIFICATION,
    varianceCop: 19_999,
  });

  await expect(decision).rejects.toThrow(VarianceNeedsApproval);
  expect(save).not.toHaveBeenCalled();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
  expect(() => stored?.finalClose()).toThrow(VarianceNeedsApproval);
});

it("given an unknown register, when a variance is approved, then UnknownRegister and nothing is saved", async () => {
  const { counts, approve } = await approveFor(shortCount());
  const save = vi.spyOn(counts, "save");

  const decision = approve.execute({
    ...scope,
    registerId: UNKNOWN_REGISTER_ID,
    approverId: SUPERVISOR_ID,
    justification: JUSTIFICATION,
    varianceCop: INSIDE_CAP_COP,
  });

  await expect(decision).rejects.toThrow(UnknownRegister);
  expect(save).not.toHaveBeenCalled();
});

it("given a count saved for one tenant, when another tenant approves it, then the count stays unapproved", async () => {
  const { counts, approve } = await approveFor(shortCount());
  const save = vi.spyOn(counts, "save");

  const decision = approve.execute({
    ...scope,
    tenantId: OTHER_TENANT_ID,
    approverId: SUPERVISOR_ID,
    justification: JUSTIFICATION,
    varianceCop: INSIDE_CAP_COP,
  });

  await expect(decision).rejects.toThrow(VarianceNeedsApproval);
  expect(save).not.toHaveBeenCalled();
  expect(await counts.find(OTHER_TENANT_ID, VENUE_ID, REGISTER_ID)).toBeNull();
  const stored = await counts.find(TENANT_ID, VENUE_ID, REGISTER_ID);
  expect(stored?.state).toBe("counting");
  expect(() => stored?.finalClose()).toThrow(VarianceNeedsApproval);
});
