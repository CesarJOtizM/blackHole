import type { ScheduledShift, WorkMode } from "#domain/project-hours.js";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Geofence extends GeoPoint {
  radiusMeters: number;
}

interface PolicyFields {
  tenantId: string;
  venueId: string;
  geofence: Geofence | null;
  toleranceMinutes: number;
  closeTime: string;
  operationRuleEnabled: boolean;
}

export type AttendancePolicy =
  | (PolicyFields & { mode: Extract<WorkMode, "hours_only"> })
  | (PolicyFields & {
      mode: Extract<WorkMode, "scheduled">;
      schedule: ScheduledShift;
    });

export const defaultAttendancePolicy = (
  tenantId: string,
  venueId: string,
): AttendancePolicy => ({
  tenantId,
  venueId,
  geofence: null,
  toleranceMinutes: 0,
  closeTime: "00:00",
  operationRuleEnabled: false,
  mode: "hours_only",
});

export abstract class AttendancePolicyRepository {
  abstract find(
    tenantId: string,
    venueId: string,
  ): Promise<AttendancePolicy | null>;

  abstract save(policy: AttendancePolicy): Promise<void>;
}
