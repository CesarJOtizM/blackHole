import {
  type AttendancePolicy,
  type AttendancePolicyRepository,
  defaultAttendancePolicy,
} from "#application/ports/attendance-policy-repository.js";
import type {
  ClockEntryCorrection,
  ClockEntryCorrectionRepository,
} from "#application/ports/clock-entry-correction-repository.js";
import type {
  ClockEntry,
  ClockEntryRepository,
} from "#application/ports/clock-entry-repository.js";
import {
  type HoursEntry,
  projectHours,
  type ScheduledShift,
} from "#domain/project-hours.js";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TipParticipant {
  userId: string;
  workedMinutes: number;
}

export interface ListTipParticipantsCommand {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
}

const inWindow = (occurredAt: string, from: string, to: string): boolean =>
  occurredAt >= from && occurredAt < to;

const ordered = (rows: readonly ClockEntry[]): ClockEntry[] =>
  [...rows].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  );

const byUser = (rows: readonly ClockEntry[]): Map<string, ClockEntry[]> => {
  const groups = new Map<string, ClockEntry[]>();

  for (const row of rows) {
    const found = groups.get(row.userId) ?? [];
    found.push(row);
    groups.set(row.userId, found);
  }

  return groups;
};

const bogotaDate = (occurredAt: string): string =>
  new Date(Date.parse(occurredAt) - BOGOTA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);

const minutesOf = (hhmm: string): number => {
  const [hour, minute] = hhmm.split(":");
  return Number(hour) * 60 + Number(minute);
};

const atBogota = (date: string, hhmm: string, dayOffset: number): string => {
  const [hour, minute] = hhmm.split(":");
  const midnight = Date.parse(`${date}T00:00:00.000Z`) + dayOffset * DAY_MS;

  return new Date(
    midnight + (Number(hour) + 5) * 60 * 60 * 1000 + Number(minute) * 60_000,
  ).toISOString();
};

const scheduleOn = (date: string, schedule: ScheduledShift): ScheduledShift => {
  const overnight = minutesOf(schedule.endsAt) <= minutesOf(schedule.startsAt);

  return {
    startsAt: atBogota(date, schedule.startsAt, 0),
    endsAt: atBogota(date, schedule.endsAt, overnight ? 1 : 0),
  };
};

const forWorker = (
  rows: readonly ClockEntry[],
  corrections: readonly ClockEntryCorrection[],
): ClockEntryCorrection[] => {
  const ids = new Set(rows.map((row) => row.id));
  return corrections.filter((row) => ids.has(row.entryId));
};

const hoursOf = (
  rows: readonly ClockEntry[],
  corrections: readonly ClockEntryCorrection[],
  policy: AttendancePolicy,
) => {
  const entries: HoursEntry[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    presence: row.presence,
    occurredAt: row.occurredAt,
  }));
  const source = {
    entries,
    corrections: corrections.map((row) => ({
      entryId: row.entryId,
      occurredAt: row.occurredAt,
      reason: row.reason,
    })),
    toleranceMinutes: policy.toleranceMinutes,
  };

  if (policy.mode === "hours_only") {
    return projectHours({ ...source, mode: "hours_only" });
  }

  const earliest = ordered(rows)[0]?.occurredAt;

  return projectHours({
    ...source,
    mode: "scheduled",
    schedule: scheduleOn(
      bogotaDate(earliest ?? new Date(0).toISOString()),
      policy.schedule,
    ),
  });
};

const participantFor = (
  userId: string,
  rows: readonly ClockEntry[],
  corrections: readonly ClockEntryCorrection[],
  policy: AttendancePolicy,
): TipParticipant => ({
  userId,
  workedMinutes: hoursOf(rows, forWorker(rows, corrections), policy)
    .workedMinutes,
});

export class ListTipParticipants {
  constructor(
    private readonly entries: ClockEntryRepository,
    private readonly corrections: ClockEntryCorrectionRepository,
    private readonly policies: AttendancePolicyRepository,
  ) {}

  async execute(
    command: ListTipParticipantsCommand,
  ): Promise<readonly TipParticipant[]> {
    const stored = await this.policies.find(command.tenantId, command.venueId);
    const policy =
      stored ?? defaultAttendancePolicy(command.tenantId, command.venueId);
    const listed = await this.entries.listByVenue(
      command.tenantId,
      command.venueId,
    );
    const rows = listed.filter((row) =>
      inWindow(row.occurredAt, command.from, command.to),
    );
    const corrections =
      rows.length === 0
        ? []
        : await this.corrections.listCorrections({
            tenantId: command.tenantId,
            entryIds: rows.map((row) => row.id),
          });
    const groups = byUser(rows);

    return [...groups.keys()]
      .sort((left, right) => left.localeCompare(right))
      .map((userId) =>
        participantFor(userId, groups.get(userId) ?? [], corrections, policy),
      );
  }
}
