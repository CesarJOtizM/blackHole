import type { PGlite } from "@electric-sql/pglite";
import { asc, inArray } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { syntheticPendingIssuances } from "#adapters/postgres/schema.js";
import type { Clock } from "#application/ports/clock.js";
import {
  isOpenIssuanceStatus,
  issuanceAgeSeconds,
  openIssuanceStatuses,
  PendingIssuance,
  type PendingIssuanceSnapshot,
  type SyntheticPendingDocument,
} from "#application/ports/pending-issuance.js";

export class DrizzlePendingIssuance extends PendingIssuance {
  private readonly database: PgliteDatabase;

  constructor(
    client: PGlite,
    private readonly clock: Clock,
  ) {
    super();
    this.database = drizzle({ client });
  }

  async record(document: SyntheticPendingDocument): Promise<void> {
    await this.database.insert(syntheticPendingIssuances).values({
      id: document.id,
      venueId: document.venueId,
      status: document.status,
      requestedAt: document.requestedAt,
    });
  }

  override async snapshot(): Promise<PendingIssuanceSnapshot[]> {
    const rows = await this.database
      .select()
      .from(syntheticPendingIssuances)
      .where(
        inArray(syntheticPendingIssuances.status, [...openIssuanceStatuses]),
      )
      .orderBy(
        asc(syntheticPendingIssuances.requestedAt),
        asc(syntheticPendingIssuances.id),
      );
    const now = this.clock.now();

    return rows.flatMap((row) => {
      if (!isOpenIssuanceStatus(row.status)) {
        return [];
      }

      return [
        {
          venueId: row.venueId,
          status: row.status,
          ageSeconds: issuanceAgeSeconds(row.requestedAt, now),
        },
      ];
    });
  }
}
