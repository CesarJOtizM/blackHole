import type { Clock } from "#application/ports/clock.js";
import type {
  ClockEntry,
  ClockEntryRepository,
} from "#application/ports/clock-entry-repository.js";
import type { ClockMark, ShiftState } from "#domain/worker-shift.js";
import { WorkerShift } from "#domain/worker-shift.js";

export interface CloseOpenShiftsCommand {
  tenantId: string;
  venueId: string;
}

const ordered = (rows: readonly ClockEntry[]): ClockEntry[] =>
  [...rows].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  );

const toMark = (entry: ClockEntry): ClockMark => ({
  kind: entry.kind,
  presence: entry.presence,
  occurredAt: entry.occurredAt,
  pendingReview: entry.pendingReview,
});

const shiftFor = (
  tenantId: string,
  userId: string,
  venueId: string,
  rows: readonly ClockEntry[],
): WorkerShift => {
  const shift = WorkerShift.open({ tenantId, userId, venueId });

  for (const row of ordered(rows)) {
    shift.record(toMark(row));
  }

  return shift;
};

const byUser = (rows: readonly ClockEntry[]): Map<string, ClockEntry[]> => {
  const groups = new Map<string, ClockEntry[]>();

  for (const row of rows) {
    const found = groups.get(row.userId) ?? [];
    found.push(row);
    groups.set(row.userId, found);
  }

  return groups;
};

const deviceIdFor = (rows: readonly ClockEntry[]): string => {
  let deviceId = "";

  for (const row of ordered(rows)) {
    if (row.presence === "matched" && row.kind === "clock_in") {
      deviceId = row.deviceId;
    }
  }

  return deviceId;
};

const isOpen = (state: ShiftState): boolean =>
  state === "on_shift" || state === "on_break";

const closeEntry = (
  tenantId: string,
  venueId: string,
  userId: string,
  rows: readonly ClockEntry[],
  occurredAt: string,
): ClockEntry => {
  const commandId = `close_${userId}_${venueId}_${occurredAt}`;

  return {
    id: `clock_entry_${commandId}`,
    tenantId,
    venueId,
    userId,
    deviceId: deviceIdFor(rows),
    kind: "clock_out",
    presence: "matched",
    occurredAt,
    commandId,
    cashRegisterId: null,
    pendingReview: true,
  };
};

const planCloses = (
  tenantId: string,
  venueId: string,
  rows: readonly ClockEntry[],
  occurredAt: string,
): ClockEntry[] => {
  const groups = byUser(rows);
  const planned: ClockEntry[] = [];

  for (const userId of [...groups.keys()].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const userRows = groups.get(userId) ?? [];
    const shift = shiftFor(tenantId, userId, venueId, userRows);

    if (!isOpen(shift.state)) {
      continue;
    }

    const entry = closeEntry(tenantId, venueId, userId, userRows, occurredAt);

    if (userRows.some((row) => row.commandId === entry.commandId)) {
      continue;
    }

    shift.record(toMark(entry));
    planned.push(entry);
  }

  return planned;
};

export class CloseOpenShifts {
  constructor(
    private readonly clock: Clock,
    private readonly entries: ClockEntryRepository,
  ) {}

  async execute(command: CloseOpenShiftsCommand): Promise<void> {
    const listed = await this.entries.listByVenue(
      command.tenantId,
      command.venueId,
    );
    const occurredAt = new Date(this.clock.now()).toISOString();
    const planned = planCloses(
      command.tenantId,
      command.venueId,
      listed,
      occurredAt,
    );

    for (const entry of planned) {
      await this.entries.append(entry);
    }
  }
}
