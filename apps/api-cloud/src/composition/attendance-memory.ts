import type { AttendancePolicy } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import { AttendancePolicyRepository } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import type { ClockEntryCorrection } from "@blackhole/attendance/application/ports/clock-entry-correction-repository";
import {
  ClockEntryCorrectionRepository,
  type ListClockEntryCorrections,
} from "@blackhole/attendance/application/ports/clock-entry-correction-repository";

const copyPolicy = (policy: AttendancePolicy): AttendancePolicy =>
  structuredClone(policy);

export class InMemoryAttendancePolicyRepository extends AttendancePolicyRepository {
  private readonly rows: AttendancePolicy[] = [];

  override async find(
    tenantId: string,
    venueId: string,
  ): Promise<AttendancePolicy | null> {
    const matches = this.rows.filter(
      (row) => row.tenantId === tenantId && row.venueId === venueId,
    );
    const latest = matches.at(-1);

    return latest === undefined ? null : copyPolicy(latest);
  }

  override async save(policy: AttendancePolicy): Promise<void> {
    this.rows.push(copyPolicy(policy));
  }
}

const copyCorrection = (
  correction: ClockEntryCorrection,
): ClockEntryCorrection => ({ ...correction });

export class InMemoryClockEntryCorrectionRepository extends ClockEntryCorrectionRepository {
  private readonly rows: ClockEntryCorrection[] = [];

  override async appendCorrection(
    correction: ClockEntryCorrection,
  ): Promise<void> {
    this.rows.push(copyCorrection(correction));
  }

  override async listCorrections(
    query: ListClockEntryCorrections,
  ): Promise<readonly ClockEntryCorrection[]> {
    const ids = new Set(query.entryIds);

    return this.rows.filter((row) => ids.has(row.entryId)).map(copyCorrection);
  }
}
