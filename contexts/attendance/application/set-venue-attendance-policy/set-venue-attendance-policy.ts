import type { AttendanceAudit } from "#application/ports/attendance-audit.js";
import {
  type AttendancePolicy,
  type AttendancePolicyRepository,
  defaultAttendancePolicy,
  type Geofence,
} from "#application/ports/attendance-policy-repository.js";
import type { ScheduledShift } from "#domain/project-hours.js";

const ACTION = "attendance.policy";
const MINUTE = /^([01]\d|2[0-3]):[0-5]\d$/;

export class InvalidAttendancePolicy extends Error {
  constructor() {
    super("The attendance policy is not valid.");
    this.name = "InvalidAttendancePolicy";
  }
}

interface PolicyChange {
  tenantId: string;
  venueId: string;
  actorId: string;
  authorizerId: string | null;
  deviceId: string;
  geofence: Geofence | null;
  toleranceMinutes: number;
  closeTime: string;
  operationRuleEnabled: boolean;
}

export type SetVenueAttendancePolicyCommand = PolicyChange &
  ({ mode: "hours_only" } | { mode: "scheduled"; schedule: ScheduledShift });

const isMinute = (value: string): boolean => MINUTE.test(value);

const policyFrom = (
  command: SetVenueAttendancePolicyCommand,
): AttendancePolicy => {
  if (
    !Number.isInteger(command.toleranceMinutes) ||
    command.toleranceMinutes < 0 ||
    !isMinute(command.closeTime)
  ) {
    throw new InvalidAttendancePolicy();
  }

  const fields = {
    tenantId: command.tenantId,
    venueId: command.venueId,
    geofence: command.geofence === null ? null : { ...command.geofence },
    toleranceMinutes: command.toleranceMinutes,
    closeTime: command.closeTime,
    operationRuleEnabled: command.operationRuleEnabled,
  };

  if (command.mode === "hours_only") {
    return { ...fields, mode: "hours_only" };
  }

  if (
    !isMinute(command.schedule.startsAt) ||
    !isMinute(command.schedule.endsAt)
  ) {
    throw new InvalidAttendancePolicy();
  }

  return {
    ...fields,
    mode: "scheduled",
    schedule: {
      startsAt: command.schedule.startsAt,
      endsAt: command.schedule.endsAt,
    },
  };
};

export class SetVenueAttendancePolicy {
  constructor(
    private readonly policies: AttendancePolicyRepository,
    private readonly audits: AttendanceAudit,
  ) {}

  async execute(
    command: SetVenueAttendancePolicyCommand,
  ): Promise<AttendancePolicy> {
    const next = policyFrom(command);
    const stored = await this.policies.find(command.tenantId, command.venueId);
    const before =
      stored ?? defaultAttendancePolicy(command.tenantId, command.venueId);

    await this.policies.save(next);
    await this.audits.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      authorizerId: command.authorizerId,
      deviceId: command.deviceId,
      siteId: command.venueId,
      action: ACTION,
      entity: command.venueId,
      before,
      after: next,
      reason: ACTION,
    });

    return next;
  }
}
