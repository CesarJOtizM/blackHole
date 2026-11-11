import type { PGlite } from "@electric-sql/pglite";
import { and, eq, lt, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { providerRateWindows } from "#adapters/postgres/schema.js";
import {
  type ProviderRateDecision,
  ProviderRateGate,
  providerRequestsPerMinute,
  providerRetryAfterSeconds,
  providerWindowStartedAt,
} from "#application/ports/provider-rate-gate.js";

export class DrizzleProviderRateGate extends ProviderRateGate {
  private readonly database: PgliteDatabase;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async acquire(
    taxId: string,
    at: Date,
    ceiling = providerRequestsPerMinute,
  ): Promise<ProviderRateDecision> {
    const windowStartedAt = providerWindowStartedAt(at);

    return this.database.transaction(async (tx) => {
      const inserted = await tx
        .insert(providerRateWindows)
        .values({
          taxId,
          windowStartedAt,
          requestCount: 1,
        })
        .onConflictDoNothing({
          target: [
            providerRateWindows.taxId,
            providerRateWindows.windowStartedAt,
          ],
        })
        .returning({ requestCount: providerRateWindows.requestCount });

      if (inserted.length === 1) {
        return { allowed: true };
      }

      const updated = await tx
        .update(providerRateWindows)
        .set({
          requestCount: sql`${providerRateWindows.requestCount} + 1`,
        })
        .where(
          and(
            eq(providerRateWindows.taxId, taxId),
            eq(providerRateWindows.windowStartedAt, windowStartedAt),
            lt(providerRateWindows.requestCount, ceiling),
          ),
        )
        .returning({ requestCount: providerRateWindows.requestCount });

      if (updated.length === 1) {
        return { allowed: true };
      }

      return {
        allowed: false,
        retryAfterSeconds: providerRetryAfterSeconds(at),
      };
    });
  }
}
