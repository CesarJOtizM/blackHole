import { expect, it } from "vitest";

import { ListStaffHours as ListedOnEntryPort } from "#application/entry-port.js";
import { ListStaffHours } from "#application/list-staff-hours/list-staff-hours.js";
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
const AUTO_CLOSE_AT = "2026-10-24T03:00:00.000Z";
const CORRECTED_OUT_AT = "2026-10-23T21:00:00.000Z";
const UNCORRECTED_MINUTES = 14 * 60;

const entry = (
  id: string,
  kind: ClockEntry["kind"],
  occurredAt: string,
): ClockEntry => ({
  id,
  tenantId: TENANT,
  venueId: VENUE,
  userId: "user_corrected",
  deviceId: "device_reader",
  kind,
  presence: "matched",
  occurredAt,
  commandId: id,
  cashRegisterId: null,
  pendingReview: occurredAt === AUTO_CLOSE_AT,
});

const clockIn = entry("clock_entry_corrected_in", "clock_in", IN_AT);
const clockOut = entry("clock_entry_corrected_out", "clock_out", AUTO_CLOSE_AT);

const correction: ClockEntryCorrection = {
  tenantId: TENANT,
  entryId: clockOut.id,
  occurredAt: CORRECTED_OUT_AT,
  reason: "Worker forgot to clock out",
};

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
    const ids = new Set(query.entryIds);

    return this.rows.filter(
      (row) => row.tenantId === query.tenantId && ids.has(row.entryId),
    );
  }
}

class MemoryPolicies extends AttendancePolicyRepository {
  override async find(): Promise<AttendancePolicy | null> {
    return null;
  }

  override async save(_stored: AttendancePolicy): Promise<void> {}
}

const period = {
  tenantId: TENANT,
  venueId: VENUE,
  from: FROM,
  to: TO,
};

it("given the attendance entry port, when staff hours are resolved, then the port exposes the same use case", () => {
  expect(ListedOnEntryPort).toBe(ListStaffHours);
});

it("given an auto-closed clock-out and a later correction, when staff hours are listed, then projectHours keeps the corrected clock", async () => {
  const listed = new ListStaffHours(
    new MemoryEntries([clockIn, clockOut]),
    new MemoryCorrections([correction]),
    new MemoryPolicies(),
  );

  const result = await listed.execute(period);

  expect(result).toEqual([
    {
      userId: "user_corrected",
      workedMinutes: 8 * 60,
      latenessMinutes: 0,
      earlyLeaveMinutes: 0,
      offScheduleMinutes: 0,
      absent: false,
      corrected: true,
    },
  ]);
  expect(result[0]?.workedMinutes).not.toBe(UNCORRECTED_MINUTES);
  expect(clockOut.occurredAt).toBe(AUTO_CLOSE_AT);
});
