import type { PGlite } from "@electric-sql/pglite";
import { desc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { attendancePolicies } from "#adapters/postgres/schema.js";
import {
  type AttendancePolicy,
  AttendancePolicyRepository,
} from "#application/ports/attendance-policy-repository.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type PolicyRow = typeof attendancePolicies.$inferSelect;

const toPolicy = (row: PolicyRow): AttendancePolicy => {
  const latitude = row.geofenceLatitude;
  const longitude = row.geofenceLongitude;
  const radiusMeters = row.geofenceRadiusMeters;
  const geofence =
    latitude === null || longitude === null || radiusMeters === null
      ? null
      : { latitude, longitude, radiusMeters };
  const fields = {
    tenantId: row.tenantId,
    venueId: row.venueId,
    geofence,
    toleranceMinutes: row.toleranceMinutes,
    closeTime: row.closeTime,
    operationRuleEnabled: row.operationRuleEnabled,
  };

  if (row.mode === "hours_only") {
    return { ...fields, mode: "hours_only" };
  }

  const startsAt = row.scheduleStartsAt;
  const endsAt = row.scheduleEndsAt;

  if (row.mode !== "scheduled" || startsAt === null || endsAt === null) {
    throw new Error("Stored attendance policy is not recognized.");
  }

  return {
    ...fields,
    mode: "scheduled",
    schedule: { startsAt, endsAt },
  };
};

const storedGeofence = (policy: AttendancePolicy) =>
  policy.geofence === null
    ? {
        geofenceLatitude: null,
        geofenceLongitude: null,
        geofenceRadiusMeters: null,
      }
    : {
        geofenceLatitude: policy.geofence.latitude,
        geofenceLongitude: policy.geofence.longitude,
        geofenceRadiusMeters: policy.geofence.radiusMeters,
      };

export class DrizzleAttendancePolicyRepository extends AttendancePolicyRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async find(
    tenantId: string,
    venueId: string,
  ): Promise<AttendancePolicy | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(attendancePolicies)
        .where(eq(attendancePolicies.venueId, venueId))
        .orderBy(desc(attendancePolicies.position))
        .limit(1);
      const row = rows[0];

      return row === undefined ? null : toPolicy(row);
    });
  }

  override async save(policy: AttendancePolicy): Promise<void> {
    await this.inTenant(policy.tenantId, async (tx) => {
      const latest = await tx
        .select({ position: attendancePolicies.position })
        .from(attendancePolicies)
        .where(eq(attendancePolicies.venueId, policy.venueId))
        .orderBy(desc(attendancePolicies.position))
        .limit(1);
      const schedule =
        policy.mode === "scheduled"
          ? {
              scheduleStartsAt: policy.schedule.startsAt,
              scheduleEndsAt: policy.schedule.endsAt,
            }
          : { scheduleStartsAt: null, scheduleEndsAt: null };

      await tx.insert(attendancePolicies).values({
        tenantId: policy.tenantId,
        venueId: policy.venueId,
        position: (latest[0]?.position ?? 0) + 1,
        ...storedGeofence(policy),
        toleranceMinutes: policy.toleranceMinutes,
        closeTime: policy.closeTime,
        operationRuleEnabled: policy.operationRuleEnabled,
        mode: policy.mode,
        ...schedule,
      });
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE attendance_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}
