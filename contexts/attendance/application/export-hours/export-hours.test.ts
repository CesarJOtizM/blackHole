import { expect, it } from "vitest";
import {
  AttendanceExportDenied,
  ExportHours,
} from "#application/export-hours/export-hours.js";
import type { AttendancePolicy } from "#application/ports/attendance-policy-repository.js";
import { AttendancePolicyRepository } from "#application/ports/attendance-policy-repository.js";
import type { ClockEntryCorrection } from "#application/ports/clock-entry-correction-repository.js";
import { ClockEntryCorrectionRepository } from "#application/ports/clock-entry-correction-repository.js";
import type { ClockEntry } from "#application/ports/clock-entry-repository.js";
import { ClockEntryRepository } from "#application/ports/clock-entry-repository.js";
import {
  HoursWorkbook,
  type HoursWorkbookSheet,
} from "#application/ports/hours-workbook.js";
import { AttendanceSiteAccess } from "#application/read-attendance/read-attendance.js";

const TENANT = "organization_tenant_1";
const VENUE = "venue_1";
const ACTOR = "user_reader";
const FROM = "2026-10-19T05:00:00.000Z";
const TO = "2026-10-26T05:00:00.000Z";
const IN_AT = "2026-10-23T13:00:00.000Z";
const OUT_AT = "2026-10-23T21:00:00.000Z";
const AUTO_CLOSE_AT = "2026-10-24T03:00:00.000Z";
const OUTSIDE_IN = "2026-10-12T13:00:00.000Z";
const OUTSIDE_OUT = "2026-10-12T21:00:00.000Z";
const FILE = Uint8Array.from([8, 0]);

const entry = (
  id: string,
  userId: string,
  kind: ClockEntry["kind"],
  occurredAt: string,
): ClockEntry => ({
  id,
  tenantId: TENANT,
  venueId: VENUE,
  userId,
  deviceId: "device_reader",
  kind,
  presence: "matched",
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

class MemoryEntries extends ClockEntryRepository {
  calls = 0;

  override async append(_entry: ClockEntry): Promise<void> {}

  override async list(): Promise<readonly ClockEntry[]> {
    return [];
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClockEntry[]> {
    this.calls += 1;
    return rows.filter(
      (row) => row.tenantId === tenantId && row.venueId === venueId,
    );
  }

  override async findByCommand(): Promise<ClockEntry | null> {
    return null;
  }
}

class MemoryCorrections extends ClockEntryCorrectionRepository {
  calls = 0;

  override async appendCorrection(
    _correction: ClockEntryCorrection,
  ): Promise<void> {}

  override async listCorrections(query: {
    tenantId: string;
    entryIds: readonly string[];
  }): Promise<readonly ClockEntryCorrection[]> {
    this.calls += 1;
    const ids = new Set(query.entryIds);
    return [correction].filter(
      (row) => row.tenantId === query.tenantId && ids.has(row.entryId),
    );
  }
}

class MemoryPolicies extends AttendancePolicyRepository {
  calls = 0;

  override async find(): Promise<AttendancePolicy | null> {
    this.calls += 1;
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

class MemoryWorkbook extends HoursWorkbook {
  calls = 0;
  sheet: HoursWorkbookSheet | null = null;

  override async write(sheet: HoursWorkbookSheet): Promise<Uint8Array> {
    this.calls += 1;
    this.sheet = sheet;
    return FILE;
  }
}

const command = {
  tenantId: TENANT,
  venueId: VENUE,
  actorId: ACTOR,
  from: FROM,
  to: TO,
};

it("given a week with a corrected clock-out, when hours are exported, then the file lists the corrected hours and has no salary", async () => {
  const workbook = new MemoryWorkbook();
  const exported = new ExportHours(
    new MemoryEntries(),
    new MemoryCorrections(),
    new MemoryPolicies(),
    new OwnSite(),
    workbook,
  );

  const file = await exported.execute(command);

  expect(file).toEqual(FILE);
  expect(workbook.sheet).toEqual({
    tenantId: TENANT,
    venueId: VENUE,
    from: FROM,
    to: TO,
    rows: [
      {
        userId: "user_corrected",
        workedMinutes: 8 * 60,
        latenessMinutes: 0,
        earlyLeaveMinutes: 0,
        offScheduleMinutes: 0,
        absent: false,
      },
    ],
  });
});

it("given a reader of another site, when hours are exported, then the export is denied and nothing is written", async () => {
  const entries = new MemoryEntries();
  const corrections = new MemoryCorrections();
  const policies = new MemoryPolicies();
  const workbook = new MemoryWorkbook();
  const exported = new ExportHours(
    entries,
    corrections,
    policies,
    new OwnSite(),
    workbook,
  );

  await expect(
    exported.execute({ ...command, venueId: "venue_other" }),
  ).rejects.toBeInstanceOf(AttendanceExportDenied);
  expect(entries.calls).toBe(0);
  expect(corrections.calls).toBe(0);
  expect(policies.calls).toBe(0);
  expect(workbook.calls).toBe(0);
});
