import { expect, it } from "vitest";

import { CloseOpenShifts } from "#application/close-open-shifts/close-open-shifts.js";
import { Clock } from "#application/ports/clock.js";
import {
  type ClockEntry,
  ClockEntryRepository,
  type ListClockEntries,
} from "#application/ports/clock-entry-repository.js";
import { ShiftTransitionRejected, WorkerShift } from "#domain/worker-shift.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const CASHIER_ID = "user_cashier";
const WAITER_ID = "user_waiter";
const DEVICE_ID = "device_phone";
const REGISTER_ID = "organization_register_front";
const IN_AT = "2026-10-23T13:00:00.000Z";
const BREAK_AT = "2026-10-23T17:00:00.000Z";
const CLOSE_AT = "2026-10-23T22:00:00.000Z";
const CLOSE_MS = Date.parse(CLOSE_AT);

const cut = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
};

class FrozenClock extends Clock {
  constructor(private readonly instant: number) {
    super();
  }

  override now(): number {
    return this.instant;
  }
}

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

class FailingCut extends MemoryClockEntries {
  readonly queuedJobs: string[] = [];

  override async append(): Promise<void> {
    throw new Error("The cut failed.");
  }
}

const row = (
  userId: string,
  kind: ClockEntry["kind"],
  overrides: Partial<ClockEntry> = {},
): ClockEntry => ({
  id: `clock_entry_${userId}_${kind}`,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  userId,
  deviceId: DEVICE_ID,
  kind,
  presence: "matched",
  occurredAt: kind === "break_start" ? BREAK_AT : IN_AT,
  commandId: `command_${userId}_${kind}`,
  cashRegisterId: null,
  pendingReview: false,
  ...overrides,
});

const commandIdFor = (userId: string): string =>
  `close_${userId}_${VENUE_ID}_${CLOSE_AT}`;

const snapshot = (rows: readonly ClockEntry[]): ClockEntry[] =>
  rows.map((item) => ({ ...item }));

const replay = (userId: string, rows: readonly ClockEntry[]) => {
  const shift = WorkerShift.open({
    tenantId: TENANT_ID,
    userId,
    venueId: VENUE_ID,
  });

  for (const item of [...rows].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  )) {
    if (item.userId !== userId) {
      continue;
    }

    shift.record({
      kind: item.kind,
      presence: item.presence,
      occurredAt: item.occurredAt,
      pendingReview: item.pendingReview,
    });
  }

  return shift;
};

const closeWith = (entries: ClockEntryRepository) =>
  new CloseOpenShifts(new FrozenClock(CLOSE_MS), entries);

it("given open matched shifts, when the venue is cut, then each gains one pending review clock-out and a second run does not duplicate it", async () => {
  const cashierIn = row(CASHIER_ID, "clock_in", {
    cashRegisterId: REGISTER_ID,
  });
  const flaggedOut = row(CASHIER_ID, "clock_out", {
    id: "clock_entry_cashier_flagged_out",
    presence: "flagged",
    occurredAt: "2026-10-23T18:00:00.000Z",
    commandId: "command_cashier_flagged_out",
  });
  const waiterIn = row(WAITER_ID, "clock_in");
  const waiterBreak = row(WAITER_ID, "break_start");
  const entries = new MemoryClockEntries();
  entries.rows.push(cashierIn, flaggedOut, waiterIn, waiterBreak);
  const before = snapshot(entries.rows);
  const close = closeWith(entries);

  await close.execute(cut);
  await close.execute(cut);

  const added = entries.rows.filter(
    (item) => !before.some((kept) => kept.id === item.id),
  );
  expect(entries.rows.slice(0, before.length)).toEqual(before);
  expect(added).toEqual([
    {
      id: `clock_entry_${commandIdFor(CASHIER_ID)}`,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      userId: CASHIER_ID,
      deviceId: DEVICE_ID,
      kind: "clock_out",
      presence: "matched",
      occurredAt: CLOSE_AT,
      commandId: commandIdFor(CASHIER_ID),
      cashRegisterId: null,
      pendingReview: true,
    },
    {
      id: `clock_entry_${commandIdFor(WAITER_ID)}`,
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      userId: WAITER_ID,
      deviceId: DEVICE_ID,
      kind: "clock_out",
      presence: "matched",
      occurredAt: CLOSE_AT,
      commandId: commandIdFor(WAITER_ID),
      cashRegisterId: null,
      pendingReview: true,
    },
  ]);
  expect(replay(CASHIER_ID, entries.rows).state).toBe("pending_review");
  expect(replay(WAITER_ID, entries.rows).state).toBe("pending_review");
});

it("given a flagged worker, a finished shift, and a shift already pending review, when the venue is cut, then nobody is clocked out", async () => {
  const flagged = row("user_flagged", "clock_in", { presence: "flagged" });
  const finishedIn = row("user_done", "clock_in");
  const finishedOut = row("user_done", "clock_out", {
    occurredAt: "2026-10-23T21:00:00.000Z",
  });
  const reviewIn = row("user_review", "clock_in");
  const reviewOut = row("user_review", "clock_out", {
    occurredAt: "2026-10-23T21:00:00.000Z",
    pendingReview: true,
  });
  const entries = new MemoryClockEntries();
  entries.rows.push(flagged, finishedIn, finishedOut, reviewIn, reviewOut);
  const before = snapshot(entries.rows);
  const close = closeWith(entries);

  await close.execute(cut);

  expect(entries.rows).toEqual(before);
});

it("given the repository rejects the cut, when an open shift is closed, then the call fails, the rows stay, and no job is queued", async () => {
  const open = row(CASHIER_ID, "clock_in", { cashRegisterId: REGISTER_ID });
  const entries = new FailingCut();
  entries.rows.push(open);
  const before = snapshot(entries.rows);
  const close = closeWith(entries);

  const act = close.execute(cut);

  await expect(act).rejects.toThrow("The cut failed.");
  expect(entries.rows).toEqual(before);
  expect(entries.queuedJobs).toEqual([]);
});

it("given one worker cannot be closed, when the venue is cut, then nobody is clocked out", async () => {
  const open = row(CASHIER_ID, "clock_in", { cashRegisterId: REGISTER_ID });
  const illegal = row(WAITER_ID, "clock_out");
  const entries = new MemoryClockEntries();
  entries.rows.push(open, illegal);
  const before = snapshot(entries.rows);
  const close = closeWith(entries);

  const act = close.execute(cut);

  await expect(act).rejects.toBeInstanceOf(ShiftTransitionRejected);
  expect(entries.rows).toEqual(before);
});
