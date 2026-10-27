import {
  type AttendancePolicy,
  type AttendancePolicyRepository,
  defaultAttendancePolicy,
  type Geofence,
  type GeoPoint,
} from "#application/ports/attendance-policy-repository.js";
import type { Clock } from "#application/ports/clock.js";
import type {
  ClockEntry,
  ClockEntryRepository,
} from "#application/ports/clock-entry-repository.js";
import type { ClockPin, PinCheck } from "#application/ports/pin-check.js";
import type { ClockKind, ClockMark } from "#domain/worker-shift.js";
import { WorkerShift } from "#domain/worker-shift.js";

const EARTH_RADIUS_METERS = 6_371_000;

export class CommandIdTaken extends Error {
  constructor() {
    super("This command already belongs to another clock entry.");
    this.name = "CommandIdTaken";
  }
}

export interface RecordClockEntryCommand {
  tenantId: string;
  venueId: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  pin: string;
  kind: ClockKind;
  coordinates: GeoPoint;
  commandId: string;
  cashRegisterId?: string;
  claimedAt?: string;
}

export interface OperationGate {
  ruleEnabled: boolean;
  counting: boolean;
}

export interface RecordClockEntryResult {
  entry: ClockEntry;
  operation: OperationGate;
  openCashRegisterId: string | null;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const distanceMeters = (left: GeoPoint, right: GeoPoint): number => {
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const start = toRadians(left.latitude);
  const end = toRadians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(start) * Math.cos(end) * Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

const presenceOf = (
  geofence: Geofence | null,
  point: GeoPoint,
): ClockEntry["presence"] => {
  if (
    geofence !== null &&
    distanceMeters(point, geofence) <= geofence.radiusMeters
  ) {
    return "matched";
  }

  return "flagged";
};

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

const isCounting = (shift: WorkerShift): boolean =>
  shift.state === "on_shift" || shift.state === "on_break";

const heldRegister = (rows: readonly ClockEntry[]): string | null => {
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

const registerFor = (
  command: RecordClockEntryCommand,
  presence: ClockEntry["presence"],
): string | null => {
  if (command.kind !== "clock_in" || presence !== "matched") {
    return null;
  }

  return command.cashRegisterId ?? null;
};

const pinFor = (command: RecordClockEntryCommand): ClockPin => ({
  tenantId: command.tenantId,
  userId: command.userId,
  pin: command.pin,
  deviceId: command.deviceId,
  sessionId: command.sessionId,
});

export class RecordClockEntry {
  constructor(
    private readonly clock: Clock,
    private readonly pins: PinCheck,
    private readonly entries: ClockEntryRepository,
    private readonly policies: AttendancePolicyRepository,
  ) {}

  async execute(
    command: RecordClockEntryCommand,
  ): Promise<RecordClockEntryResult> {
    await this.pins.confirm(pinFor(command));
    const listed = await this.entries.list({
      tenantId: command.tenantId,
      venueId: command.venueId,
      userId: command.userId,
    });
    const policy = await this.policyFor(command.tenantId, command.venueId);
    const taken = await this.entries.findByCommand(
      command.tenantId,
      command.commandId,
    );

    if (taken) {
      if (
        taken.userId !== command.userId ||
        taken.venueId !== command.venueId
      ) {
        throw new CommandIdTaken();
      }

      return this.view(command, listed, taken, policy);
    }

    const entry = this.entryFor(command, policy);
    const shift = shiftFor(
      command.tenantId,
      command.userId,
      command.venueId,
      listed,
    );
    shift.record(toMark(entry));
    await this.entries.append(entry);
    const stored = await this.entries.findByCommand(
      command.tenantId,
      command.commandId,
    );

    if (
      !stored ||
      stored.userId !== command.userId ||
      stored.venueId !== command.venueId
    ) {
      throw new CommandIdTaken();
    }

    return this.view(command, [...listed, stored], stored, policy);
  }

  private async policyFor(
    tenantId: string,
    venueId: string,
  ): Promise<AttendancePolicy> {
    return (
      (await this.policies.find(tenantId, venueId)) ??
      defaultAttendancePolicy(tenantId, venueId)
    );
  }

  private entryFor(
    command: RecordClockEntryCommand,
    policy: AttendancePolicy,
  ): ClockEntry {
    const presence = presenceOf(policy.geofence, command.coordinates);

    return {
      id: `clock_entry_${command.commandId}`,
      tenantId: command.tenantId,
      venueId: command.venueId,
      userId: command.userId,
      deviceId: command.deviceId,
      kind: command.kind,
      presence,
      occurredAt: new Date(this.clock.now()).toISOString(),
      commandId: command.commandId,
      cashRegisterId: registerFor(command, presence),
      pendingReview: false,
    };
  }

  private view(
    command: RecordClockEntryCommand,
    rows: readonly ClockEntry[],
    entry: ClockEntry,
    policy: AttendancePolicy,
  ): RecordClockEntryResult {
    const counting = isCounting(
      shiftFor(command.tenantId, command.userId, command.venueId, rows),
    );

    return {
      entry,
      operation: {
        ruleEnabled: policy.operationRuleEnabled,
        counting,
      },
      openCashRegisterId: counting ? heldRegister(rows) : null,
    };
  }
}
