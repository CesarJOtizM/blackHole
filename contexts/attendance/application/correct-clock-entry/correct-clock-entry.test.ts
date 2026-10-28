import { expect, it } from "vitest";

import {
  CorrectClockEntry,
  type CorrectClockEntryCommand,
  CorrectionReasonRequired,
  UnknownClockEntry,
} from "#application/correct-clock-entry/correct-clock-entry.js";
import {
  AttendanceAudit,
  type AttendanceAuditCommand,
} from "#application/ports/attendance-audit.js";
import {
  type ClockEntryCorrection,
  ClockEntryCorrectionRepository,
  type ListClockEntryCorrections,
} from "#application/ports/clock-entry-correction-repository.js";
import {
  type ClockEntry,
  ClockEntryRepository,
  type ListClockEntries,
} from "#application/ports/clock-entry-repository.js";
import { projectHours } from "#domain/project-hours.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const USER_ID = "user_cashier";
const ACTOR_ID = "user_admin";
const DEVICE_ID = "device_admin";
const IN_ID = "attendance_entry_in";
const ENTRY_ID = "attendance_entry_out";
const IN_AT = "2026-10-23T13:00:00.000Z";
const ORIGINAL_OUT_AT = "2026-10-24T03:00:00.000Z";
const REPLACEMENT_AT = "2026-10-23T21:00:00.000Z";
const REASON = "Worker forgot to clock out";

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

class MemoryCorrections extends ClockEntryCorrectionRepository {
  readonly rows: ClockEntryCorrection[] = [];

  override async appendCorrection(
    correction: ClockEntryCorrection,
  ): Promise<void> {
    this.rows.push({ ...correction });
  }

  override async listCorrections(
    query: ListClockEntryCorrections,
  ): Promise<readonly ClockEntryCorrection[]> {
    return this.rows
      .filter(
        (row) =>
          row.tenantId === query.tenantId &&
          query.entryIds.includes(row.entryId),
      )
      .map((row) => ({ ...row }));
  }
}

class RecordingAudit extends AttendanceAudit {
  readonly calls: AttendanceAuditCommand[] = [];
  readonly storedBeforeRecord: number[] = [];

  constructor(private readonly corrections: MemoryCorrections) {
    super();
  }

  override async record(command: AttendanceAuditCommand): Promise<void> {
    const stored = await this.corrections.listCorrections({
      tenantId: command.tenantId,
      entryIds: [command.entity],
    });

    this.storedBeforeRecord.push(stored.length);
    this.calls.push({ ...command });
  }
}

const entry = (
  id: string,
  kind: ClockEntry["kind"],
  occurredAt: string,
): ClockEntry => ({
  id,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  userId: USER_ID,
  deviceId: "device_phone",
  kind,
  presence: "matched",
  occurredAt,
  commandId: `command_${id}`,
  cashRegisterId: null,
  pendingReview: false,
});

const scope = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  userId: USER_ID,
};

const harness = async () => {
  const entries = new MemoryClockEntries();
  const corrections = new MemoryCorrections();
  const audit = new RecordingAudit(corrections);
  const correct = new CorrectClockEntry(entries, corrections, audit);

  await entries.append(entry(IN_ID, "clock_in", IN_AT));
  await entries.append(entry(ENTRY_ID, "clock_out", ORIGINAL_OUT_AT));

  return { entries, corrections, audit, correct };
};

const command = (
  overrides: Partial<CorrectClockEntryCommand> = {},
): CorrectClockEntryCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  userId: USER_ID,
  actorId: ACTOR_ID,
  authorizerId: null,
  deviceId: DEVICE_ID,
  entryId: ENTRY_ID,
  occurredAt: REPLACEMENT_AT,
  reason: REASON,
  ...overrides,
});

it("given an auto-closed clock-out, when an administrator corrects it with a reason, then the original stays, hours use the correction, and the audit records it", async () => {
  const { entries, corrections, audit, correct } = await harness();
  const before = await entries.list(scope);

  await correct.execute(command());

  const listed = await entries.list(scope);
  const stored = await corrections.listCorrections({
    tenantId: TENANT_ID,
    entryIds: [ENTRY_ID],
  });
  const projection = projectHours({
    mode: "hours_only",
    entries: listed.map((row) => ({
      id: row.id,
      kind: row.kind,
      presence: row.presence,
      occurredAt: row.occurredAt,
    })),
    corrections: stored,
    toleranceMinutes: 0,
  });

  expect(listed).toEqual(before);
  expect(listed.find((row) => row.id === ENTRY_ID)?.occurredAt).toBe(
    ORIGINAL_OUT_AT,
  );
  expect(stored).toEqual([
    {
      tenantId: TENANT_ID,
      entryId: ENTRY_ID,
      occurredAt: REPLACEMENT_AT,
      reason: REASON,
    },
  ]);
  expect(projection.workedMinutes).toBe(8 * 60);
  expect(audit.storedBeforeRecord).toEqual([1]);
  expect(audit.calls).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: DEVICE_ID,
      siteId: VENUE_ID,
      action: "attendance.correct",
      entity: ENTRY_ID,
      before: ORIGINAL_OUT_AT,
      after: REPLACEMENT_AT,
      reason: REASON,
    },
  ]);
});

it("given an empty or blank reason, when an administrator corrects a clock entry, then nothing is stored and the audit is not called", async () => {
  const { entries, corrections, audit, correct } = await harness();
  const before = await entries.list(scope);

  const empty = correct.execute(command({ reason: "" }));
  const blank = correct.execute(command({ reason: "   " }));

  await expect(empty).rejects.toBeInstanceOf(CorrectionReasonRequired);
  await expect(blank).rejects.toBeInstanceOf(CorrectionReasonRequired);
  expect(await entries.list(scope)).toEqual(before);
  expect(
    await corrections.listCorrections({
      tenantId: TENANT_ID,
      entryIds: [ENTRY_ID],
    }),
  ).toEqual([]);
  expect(audit.calls).toEqual([]);
});

it("given an unknown clock entry, when an administrator corrects it, then nothing is stored and the audit is not called", async () => {
  const { entries, corrections, audit, correct } = await harness();
  const before = await entries.list(scope);

  const act = correct.execute(command({ entryId: "attendance_entry_missing" }));

  await expect(act).rejects.toBeInstanceOf(UnknownClockEntry);
  expect(await entries.list(scope)).toEqual(before);
  expect(
    await corrections.listCorrections({
      tenantId: TENANT_ID,
      entryIds: [ENTRY_ID],
    }),
  ).toEqual([]);
  expect(audit.calls).toEqual([]);
});
