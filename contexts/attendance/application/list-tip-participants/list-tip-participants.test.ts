import { expect, it } from "vitest";

import { ListTipParticipants as ListedOnEntryPort } from "#application/entry-port.js";
import { ListTipParticipants } from "#application/list-tip-participants/list-tip-participants.js";
import type { AttendancePolicy } from "#application/ports/attendance-policy-repository.js";
import { AttendancePolicyRepository } from "#application/ports/attendance-policy-repository.js";
import type { ClockEntryCorrection } from "#application/ports/clock-entry-correction-repository.js";
import { ClockEntryCorrectionRepository } from "#application/ports/clock-entry-correction-repository.js";
import type { ClockEntry } from "#application/ports/clock-entry-repository.js";
import { ClockEntryRepository } from "#application/ports/clock-entry-repository.js";

const TENANT = "organization_tenant_1";
const VENUE = "venue_1";
const FROM = "2026-10-19T05:00:00.000Z";
const TO = "2026-10-26T05:00:00.000Z";
const IN_AT = "2026-10-23T13:00:00.000Z";
const BREAK_START_AT = "2026-10-23T17:00:00.000Z";
const BREAK_END_AT = "2026-10-23T17:30:00.000Z";
const OUT_AT = "2026-10-23T21:00:00.000Z";
const LATE_AT = "2026-10-23T13:25:00.000Z";
const AUTO_CLOSE_AT = "2026-10-24T03:00:00.000Z";
const OUTSIDE_IN = "2026-10-12T13:00:00.000Z";
const OUTSIDE_OUT = "2026-10-12T21:00:00.000Z";

const scheduled: AttendancePolicy = {
  tenantId: TENANT,
  venueId: VENUE,
  geofence: null,
  toleranceMinutes: 10,
  closeTime: "22:00",
  operationRuleEnabled: false,
  mode: "scheduled",
  schedule: { startsAt: "08:00", endsAt: "16:00" },
};

const entry = (
  id: string,
  userId: string,
  kind: ClockEntry["kind"],
  occurredAt: string,
  presence: ClockEntry["presence"] = "matched",
): ClockEntry => ({
  id,
  tenantId: TENANT,
  venueId: VENUE,
  userId,
  deviceId: "device_reader",
  kind,
  presence,
  occurredAt,
  commandId: id,
  cashRegisterId: null,
  pendingReview: kind === "clock_out" && occurredAt === AUTO_CLOSE_AT,
});

const correction: ClockEntryCorrection = {
  tenantId: TENANT,
  entryId: "clock_entry_corrected_out",
  occurredAt: OUT_AT,
  reason: "Worker forgot to clock out",
};

const rows = [
  entry("clock_entry_hours_in", "user_hours", "clock_in", IN_AT),
  entry(
    "clock_entry_hours_break_start",
    "user_hours",
    "break_start",
    BREAK_START_AT,
  ),
  entry("clock_entry_hours_break_end", "user_hours", "break_end", BREAK_END_AT),
  entry("clock_entry_hours_out", "user_hours", "clock_out", OUT_AT),
  entry("clock_entry_late_in", "user_late", "clock_in", LATE_AT),
  entry("clock_entry_late_out", "user_late", "clock_out", OUT_AT),
  entry("clock_entry_open_in", "user_open", "clock_in", IN_AT),
  entry("clock_entry_flagged_in", "user_flagged", "clock_in", IN_AT, "flagged"),
  entry(
    "clock_entry_flagged_out",
    "user_flagged",
    "clock_out",
    OUT_AT,
    "flagged",
  ),
  entry("clock_entry_corrected_in", "user_corrected", "clock_in", IN_AT),
  entry(
    "clock_entry_corrected_out",
    "user_corrected",
    "clock_out",
    AUTO_CLOSE_AT,
  ),
  entry("clock_entry_outside_in", "user_outside", "clock_in", OUTSIDE_IN),
  entry("clock_entry_outside_out", "user_outside", "clock_out", OUTSIDE_OUT),
];

const participants = [
  { userId: "user_corrected", workedMinutes: 8 * 60 },
  { userId: "user_flagged", workedMinutes: 0 },
  { userId: "user_hours", workedMinutes: 7 * 60 + 30 },
  { userId: "user_late", workedMinutes: 7 * 60 + 35 },
  { userId: "user_open", workedMinutes: 0 },
];

class MemoryEntries extends ClockEntryRepository {
  constructor(private readonly rows: readonly ClockEntry[]) {
    super();
  }

  override async append(_entry: ClockEntry): Promise<void> {}

  override async list(): Promise<readonly ClockEntry[]> {
    return [];
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClockEntry[]> {
    return this.rows.filter(
      (row) => row.tenantId === tenantId && row.venueId === venueId,
    );
  }

  override async findByCommand(): Promise<ClockEntry | null> {
    return null;
  }
}

class MemoryCorrections extends ClockEntryCorrectionRepository {
  calls = 0;

  constructor(private readonly rows: readonly ClockEntryCorrection[]) {
    super();
  }

  override async appendCorrection(
    _correction: ClockEntryCorrection,
  ): Promise<void> {}

  override async listCorrections(query: {
    tenantId: string;
    entryIds: readonly string[];
  }): Promise<readonly ClockEntryCorrection[]> {
    this.calls += 1;
    const ids = new Set(query.entryIds);
    return this.rows.filter(
      (row) => row.tenantId === query.tenantId && ids.has(row.entryId),
    );
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
      this.policy !== null &&
      this.policy.tenantId === tenantId &&
      this.policy.venueId === venueId
    ) {
      return this.policy;
    }

    return null;
  }

  override async save(_stored: AttendancePolicy): Promise<void> {}
}

const list = (policy: AttendancePolicy | null) =>
  new ListTipParticipants(
    new MemoryEntries(rows),
    new MemoryCorrections([correction]),
    new MemoryPolicies(policy),
  );

const period = {
  tenantId: TENANT,
  venueId: VENUE,
  from: FROM,
  to: TO,
};

it("given the attendance entry port, when tip participants are resolved, then the port exposes the same use case", () => {
  expect(ListedOnEntryPort).toBe(ListTipParticipants);
});

it("given clock events in a venue period and no stored policy, when tip participants are listed, then each user in the period is returned with hours-only worked minutes", async () => {
  const listed = list(null);

  const result = await listed.execute(period);

  expect(result).toEqual(participants);
});

it("given a scheduled policy with tolerance, when tip participants are listed, then worked minutes follow the same projection", async () => {
  const listed = list(scheduled);

  const result = await listed.execute(period);

  expect(result).toEqual(participants);
});

it("given a mark on the period end, when tip participants are listed, then the half-open window excludes it", async () => {
  const edgeOut = "2026-10-23T14:00:00.000Z";
  const listed = new ListTipParticipants(
    new MemoryEntries([
      entry("clock_entry_start_in", "user_start", "clock_in", IN_AT),
      entry(
        "clock_entry_start_out",
        "user_start",
        "clock_out",
        "2026-10-23T13:30:00.000Z",
      ),
      entry("clock_entry_end_in", "user_end", "clock_in", edgeOut),
      entry(
        "clock_entry_end_out",
        "user_end",
        "clock_out",
        "2026-10-23T14:30:00.000Z",
      ),
    ]),
    new MemoryCorrections([]),
    new MemoryPolicies(null),
  );

  const result = await listed.execute({
    tenantId: TENANT,
    venueId: VENUE,
    from: IN_AT,
    to: edgeOut,
  });

  expect(result).toEqual([{ userId: "user_start", workedMinutes: 30 }]);
});

it("given no clock events in the period, when tip participants are listed, then the result is empty and corrections are not loaded", async () => {
  const corrections = new MemoryCorrections([correction]);
  const listed = new ListTipParticipants(
    new MemoryEntries(rows),
    corrections,
    new MemoryPolicies(null),
  );

  const result = await listed.execute({
    tenantId: TENANT,
    venueId: VENUE,
    from: "2026-01-01T05:00:00.000Z",
    to: "2026-01-02T05:00:00.000Z",
  });

  expect(result).toEqual([]);
  expect(corrections.calls).toBe(0);
});
