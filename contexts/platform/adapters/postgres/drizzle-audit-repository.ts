import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { auditEvents } from "#adapters/postgres/schema.js";
import {
  type AuditEvent,
  type AuditRecordKind,
  AuditRepository,
} from "#application/ports/audit-repository.js";
import { AuditSequenceConflict } from "#domain/audit.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const KINDS = ["event", "altered", "deleted"] as const;

const isKind = (value: string): value is AuditRecordKind =>
  KINDS.some((kind) => kind === value);

const isUniqueViolation = (error: unknown): boolean => {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const record = current as {
      code?: string;
      message?: string;
      cause?: unknown;
    };

    if (record.code === "23505") {
      return true;
    }

    if (
      typeof record.message === "string" &&
      record.message.includes("duplicate key")
    ) {
      return true;
    }

    current = record.cause;
  }

  return false;
};

const toEvent = (row: typeof auditEvents.$inferSelect): AuditEvent => {
  if (!isKind(row.recordKind)) {
    throw new Error("Stored audit kind is not recognized.");
  }

  return {
    tenantId: row.tenantId,
    actorId: row.actorId,
    authorizerId: row.authorizerId,
    deviceId: row.deviceId,
    siteId: row.siteId,
    action: row.action,
    entity: row.entity,
    before: row.beforeValue,
    after: row.afterValue,
    reason: row.reason,
    occurredAt: row.occurredAt,
    sequence: row.sequence,
    previousHash: row.previousHash,
    digest: row.digest,
    kind: row.recordKind,
  };
};

const inTenant = async <T>(
  database: Database,
  tenantId: string,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> =>
  database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE audit_app`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );

    return work(tx);
  });

export class DrizzleAuditRepository extends AuditRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async append(event: AuditEvent): Promise<void> {
    await inTenant(this.database, event.tenantId, async (tx) => {
      let inserted: { id: string }[] = [];

      try {
        inserted = await tx
          .insert(auditEvents)
          .values({
            id: `${event.tenantId}:${event.deviceId}:${event.sequence}:${event.kind}`,
            tenantId: event.tenantId,
            actorId: event.actorId,
            authorizerId: event.authorizerId,
            deviceId: event.deviceId,
            siteId: event.siteId,
            action: event.action,
            entity: event.entity,
            beforeValue: event.before,
            afterValue: event.after,
            reason: event.reason,
            occurredAt: event.occurredAt,
            sequence: event.sequence,
            previousHash: event.previousHash,
            digest: event.digest,
            recordKind: event.kind,
          })
          .onConflictDoNothing({
            target: [
              auditEvents.tenantId,
              auditEvents.deviceId,
              auditEvents.sequence,
              auditEvents.recordKind,
            ],
          })
          .returning({ id: auditEvents.id });
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }

      if (inserted.length > 0) {
        return;
      }

      const [row] = await tx
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.deviceId, event.deviceId),
            eq(auditEvents.sequence, event.sequence),
            eq(auditEvents.recordKind, event.kind),
          ),
        );

      if (!row || toEvent(row).digest !== event.digest) {
        throw new AuditSequenceConflict();
      }
    });
  }

  override async list(
    tenantId: string,
    deviceId: string | null,
  ): Promise<readonly AuditEvent[]> {
    return inTenant(this.database, tenantId, async (tx) => {
      const selected =
        deviceId === null
          ? tx.select().from(auditEvents)
          : tx
              .select()
              .from(auditEvents)
              .where(eq(auditEvents.deviceId, deviceId));
      const rows = await selected.orderBy(
        asc(auditEvents.deviceId),
        asc(auditEvents.sequence),
        asc(auditEvents.recordKind),
      );

      return rows.map(toEvent);
    });
  }
}
