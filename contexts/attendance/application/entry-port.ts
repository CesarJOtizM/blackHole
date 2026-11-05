import {
  type AttendancePolicyRepository,
  defaultAttendancePolicy,
} from "#application/ports/attendance-policy-repository.js";
import type {
  ClockEntry,
  ClockEntryRepository,
} from "#application/ports/clock-entry-repository.js";
import { type ClockMark, WorkerShift } from "#domain/worker-shift.js";

interface AttendanceCaller {
  tenantId: string;
  venueId: string;
  userId: string;
}

interface OpenClockInView {
  ruleEnabled: boolean;
  counting: boolean;
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

const replay = (
  caller: AttendanceCaller,
  rows: readonly ClockEntry[],
): WorkerShift => {
  const shift = WorkerShift.open(caller);

  for (const row of ordered(rows)) {
    shift.record(toMark(row));
  }

  return shift;
};

const isCounting = (shift: WorkerShift): boolean =>
  shift.state === "on_shift" || shift.state === "on_break";

const openCashRegisterId = (rows: readonly ClockEntry[]): string | null => {
  let register: string | null = null;

  for (const row of ordered(rows)) {
    if (row.presence !== "matched") {
      continue;
    }

    if (row.kind === "clock_in") {
      register = row.cashRegisterId;
    }

    if (row.kind === "clock_out") {
      register = null;
    }
  }

  return register;
};

export class HasOpenClockIn {
  constructor(
    private readonly entries: ClockEntryRepository,
    private readonly policies: AttendancePolicyRepository,
  ) {}

  async execute(caller: AttendanceCaller): Promise<OpenClockInView> {
    const rows = await this.entries.list(caller);
    const stored = await this.policies.find(caller.tenantId, caller.venueId);
    const policy =
      stored ?? defaultAttendancePolicy(caller.tenantId, caller.venueId);

    return {
      ruleEnabled: policy.operationRuleEnabled,
      counting: isCounting(replay(caller, rows)),
    };
  }
}

export class HasClockedInCashier {
  constructor(private readonly entries: ClockEntryRepository) {}

  async execute(caller: AttendanceCaller): Promise<boolean> {
    const rows = await this.entries.list(caller);
    const counting = isCounting(replay(caller, rows));

    return counting && openCashRegisterId(rows) !== null;
  }
}

export type {
  ListTipParticipantsCommand,
  TipParticipant,
} from "#application/list-tip-participants/list-tip-participants.js";
export { ListTipParticipants } from "#application/list-tip-participants/list-tip-participants.js";
