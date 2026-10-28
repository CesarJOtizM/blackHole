import { expect, it } from "vitest";

import {
  HasClockedInCashier,
  HasOpenClockIn,
} from "#application/entry-port.js";
import {
  type AttendancePolicy,
  AttendancePolicyRepository,
  defaultAttendancePolicy,
} from "#application/ports/attendance-policy-repository.js";
import {
  type ClockEntry,
  ClockEntryRepository,
  type ListClockEntries,
} from "#application/ports/clock-entry-repository.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const USER_ID = "user_cashier";
const DEVICE_ID = "device_phone";
const REGISTER_ID = "organization_register_front";
const IN_AT = "2026-10-23T13:00:00.000Z";
const OUT_AT = "2026-10-23T21:00:00.000Z";

const ask = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  userId: USER_ID,
};

class MemoryClockEntries extends ClockEntryRepository {
  readonly rows: ClockEntry[] = [];

  override async append(entry: ClockEntry): Promise<void> {
    this.rows.push({ ...entry });
  }

  override async list(query: ListClockEntries): Promise<readonly ClockEntry[]> {
    return this.rows
      .filter(
        (row) =>
          row.tenantId === query.tenantId &&
          row.venueId === query.venueId &&
          row.userId === query.userId,
      )
      .map((row) => ({ ...row }));
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClockEntry[]> {
    return this.rows
      .filter((row) => row.tenantId === tenantId && row.venueId === venueId)
      .map((row) => ({ ...row }));
  }

  override async findByCommand(
    tenantId: string,
    commandId: string,
  ): Promise<ClockEntry | null> {
    const row = this.rows.find(
      (item) => item.tenantId === tenantId && item.commandId === commandId,
    );

    return row === undefined ? null : { ...row };
  }
}

class MemoryPolicies extends AttendancePolicyRepository {
  constructor(private readonly policy: AttendancePolicy | null) {
    super();
  }

  override async find(
    tenantId: string,
    venueId: string,
  ): Promise<AttendancePolicy | null> {
    if (
      this.policy === null ||
      this.policy.tenantId !== tenantId ||
      this.policy.venueId !== venueId
    ) {
      return null;
    }

    return this.policy;
  }

  override async save(_policy: AttendancePolicy): Promise<void> {}
}

const ruleOn = (): AttendancePolicy => ({
  ...defaultAttendancePolicy(TENANT_ID, VENUE_ID),
  operationRuleEnabled: true,
});

const entry = (
  kind: ClockEntry["kind"],
  overrides: Partial<ClockEntry> = {},
): ClockEntry => ({
  id: `clock_entry_${kind}`,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  userId: USER_ID,
  deviceId: DEVICE_ID,
  kind,
  presence: "matched",
  occurredAt: kind === "clock_out" ? OUT_AT : IN_AT,
  commandId: `command_${kind}`,
  cashRegisterId: null,
  pendingReview: false,
  ...overrides,
});

const ports = (policy: AttendancePolicy | null, rows: ClockEntry[] = []) => {
  const entries = new MemoryClockEntries();
  entries.rows.push(...rows);

  return {
    openClockIn: new HasOpenClockIn(entries, new MemoryPolicies(policy)),
    cashier: new HasClockedInCashier(entries),
  };
};

it("given the rule is off and the worker has no entries, when a caller asks, then the rule is off and counting is false", async () => {
  const { openClockIn } = ports(null);

  const result = await openClockIn.execute(ask);

  expect(result).toEqual({ ruleEnabled: false, counting: false });
});

it("given the rule is on and the worker has no entries, when a caller asks, then the rule is on and counting is false", async () => {
  const { openClockIn } = ports(ruleOn());

  const result = await openClockIn.execute(ask);

  expect(result).toEqual({ ruleEnabled: true, counting: false });
});

it("given the rule is on and a matched clock-in, when a caller asks, then counting is true", async () => {
  const { openClockIn } = ports(ruleOn(), [entry("clock_in")]);

  const result = await openClockIn.execute(ask);

  expect(result).toEqual({ ruleEnabled: true, counting: true });
});

it("given the rule is on and only a flagged clock-in, when a caller asks, then counting is false", async () => {
  const { openClockIn } = ports(ruleOn(), [
    entry("clock_in", { presence: "flagged" }),
  ]);

  const result = await openClockIn.execute(ask);

  expect(result).toEqual({ ruleEnabled: true, counting: false });
});

it("given a matched open clock-in with a cash register, when a caller asks if the worker is a cashier, then the answer is true", async () => {
  const { cashier } = ports(null, [
    entry("clock_in", { cashRegisterId: REGISTER_ID }),
  ]);

  expect(await cashier.execute(ask)).toBe(true);
});

it("given a matched open clock-in without a cash register, when a caller asks if the worker is a cashier, then the answer is false", async () => {
  const { cashier } = ports(null, [entry("clock_in")]);

  expect(await cashier.execute(ask)).toBe(false);
});

it("given a flagged clock-in with a cash register, when a caller asks if the worker is a cashier, then the answer is false", async () => {
  const { cashier } = ports(null, [
    entry("clock_in", {
      presence: "flagged",
      cashRegisterId: REGISTER_ID,
    }),
  ]);

  expect(await cashier.execute(ask)).toBe(false);
});

it("given a matched clock-in and a later matched clock-out, when a caller asks, then counting is false and the worker is not a cashier", async () => {
  const rows = [
    entry("clock_in", { cashRegisterId: REGISTER_ID }),
    entry("clock_out"),
  ];
  const { openClockIn, cashier } = ports(ruleOn(), rows);

  const result = await openClockIn.execute(ask);

  expect(result).toEqual({ ruleEnabled: true, counting: false });
  expect(await cashier.execute(ask)).toBe(false);
});
