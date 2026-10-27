import { expect, it } from "vitest";

import type { AttendancePolicy } from "#application/ports/attendance-policy-repository.js";
import { AttendancePolicyRepository } from "#application/ports/attendance-policy-repository.js";
import type { ClockEntryCorrection } from "#application/ports/clock-entry-correction-repository.js";
import { ClockEntryCorrectionRepository } from "#application/ports/clock-entry-correction-repository.js";
import type { ClockEntry } from "#application/ports/clock-entry-repository.js";
import { ClockEntryRepository } from "#application/ports/clock-entry-repository.js";
import {
  AttendanceReadDenied,
  AttendanceSiteAccess,
  ReadAttendance,
} from "#application/read-attendance/read-attendance.js";

const TENANT = "organization_tenant_1";
const VENUE = "venue_1";
const ACTOR = "user_reader";
const IN_AT = "2026-10-23T13:00:00.000Z";
const BREAK_START_AT = "2026-10-23T17:00:00.000Z";
const BREAK_END_AT = "2026-10-23T17:30:00.000Z";
const OUT_AT = "2026-10-23T21:00:00.000Z";
const LATE_AT = "2026-10-23T13:25:00.000Z";
const AUTO_CLOSE_AT = "2026-10-24T03:00:00.000Z";

const policy: AttendancePolicy = {
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
  pendingReview: false,
});

class MemoryEntries extends ClockEntryRepository {
  calls = 0;

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
    this.calls += 1;
    return this.rows.filter(
      (row) => row.tenantId === tenantId && row.venueId === venueId,
    );
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
    entryIds: readonly string[];
  }): Promise<readonly ClockEntryCorrection[]> {
    this.calls += 1;
    const ids = new Set(query.entryIds);
    return this.rows.filter((row) => ids.has(row.entryId));
  }
}

class MemoryPolicies extends AttendancePolicyRepository {
  calls = 0;

  override async find(
    tenantId: string,
    venueId: string,
  ): Promise<AttendancePolicy | null> {
    this.calls += 1;
    if (tenantId === policy.tenantId && venueId === policy.venueId) {
      return policy;
    }

    return null;
  }

  override async save(_stored: AttendancePolicy): Promise<void> {}
}

class OwnSite extends AttendanceSiteAccess {
  override async allow(input: {
    tenantId: string;
    actorId: string;
    venueId: string;
    permission: "attendance.correct";
  }): Promise<boolean> {
    return (
      input.tenantId === TENANT &&
      input.actorId === ACTOR &&
      input.venueId === VENUE &&
      input.permission === "attendance.correct"
    );
  }
}

const correction: ClockEntryCorrection = {
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
  entry("clock_entry_present_in", "user_present", "clock_in", IN_AT),
  entry("clock_entry_absent_in", "user_absent", "clock_in", LATE_AT, "flagged"),
  entry("clock_entry_corrected_in", "user_corrected", "clock_in", IN_AT),
  entry(
    "clock_entry_corrected_out",
    "user_corrected",
    "clock_out",
    AUTO_CLOSE_AT,
  ),
];

const clear = {
  latenessMinutes: 0,
  earlyLeaveMinutes: 0,
  offScheduleMinutes: 0,
  absent: false,
  corrections: [],
};

it("given a scheduled site, when attendance is read, then hours, lateness, absences, corrections, and presence skip flagged marks", async () => {
  const read = new ReadAttendance(
    new MemoryEntries(rows),
    new MemoryCorrections([correction]),
    new MemoryPolicies(),
    new OwnSite(),
  );

  const report = await read.execute({
    tenantId: TENANT,
    venueId: VENUE,
    actorId: ACTOR,
  });

  expect(report.workers).toEqual([
    {
      userId: "user_absent",
      state: "off_shift",
      workedMinutes: 0,
      ...clear,
      absent: true,
    },
    {
      userId: "user_corrected",
      state: "off_shift",
      workedMinutes: 8 * 60,
      ...clear,
      corrections: [correction],
    },
    {
      userId: "user_hours",
      state: "off_shift",
      workedMinutes: 7 * 60 + 30,
      ...clear,
    },
    {
      userId: "user_late",
      state: "off_shift",
      workedMinutes: 7 * 60 + 35,
      ...clear,
      latenessMinutes: 25,
    },
    {
      userId: "user_present",
      state: "on_shift",
      workedMinutes: 0,
      ...clear,
    },
  ]);
});

it("given a reader of another site, when attendance is read, then the read is denied and nothing is listed", async () => {
  const entries = new MemoryEntries(rows);
  const corrections = new MemoryCorrections([correction]);
  const policies = new MemoryPolicies();
  const read = new ReadAttendance(
    entries,
    corrections,
    policies,
    new OwnSite(),
  );

  await expect(
    read.execute({
      tenantId: TENANT,
      venueId: "venue_other",
      actorId: ACTOR,
    }),
  ).rejects.toBeInstanceOf(AttendanceReadDenied);
  expect(entries.calls).toBe(0);
  expect(corrections.calls).toBe(0);
  expect(policies.calls).toBe(0);
});
