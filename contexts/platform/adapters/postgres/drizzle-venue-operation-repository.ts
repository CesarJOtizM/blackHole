import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import {
  operationalWrites,
  venueOperations,
} from "#adapters/postgres/schema.js";
import type { OperationalWrite } from "#application/ports/venue-operation-repository.js";
import { VenueOperationRepository } from "#application/ports/venue-operation-repository.js";
import { VenueOperation } from "#domain/venue-operation.js";

export class DrizzleVenueOperationRepository extends VenueOperationRepository {
  private readonly database: PgliteDatabase;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async save(operation: VenueOperation): Promise<void> {
    await this.database
      .insert(venueOperations)
      .values({
        venueId: operation.venueId,
        mode: operation.mode,
        operationOwner: operation.operationOwner,
        generation: operation.generation,
      })
      .onConflictDoUpdate({
        target: venueOperations.venueId,
        set: {
          mode: operation.mode,
          operationOwner: operation.operationOwner,
          generation: operation.generation,
        },
      });
  }

  override async findByVenueId(
    venueId: string,
  ): Promise<VenueOperation | null> {
    const [row] = await this.database
      .select()
      .from(venueOperations)
      .where(eq(venueOperations.venueId, venueId));

    if (row === undefined) {
      return null;
    }

    const operation = VenueOperation.openCloud(row.venueId);

    if (
      row.mode !== operation.mode ||
      row.operationOwner !== operation.operationOwner ||
      row.generation !== operation.generation
    ) {
      throw new Error("Stored venue operation is not a cloud operation.");
    }

    return operation;
  }

  override async saveWrite(write: OperationalWrite): Promise<void> {
    await this.database
      .insert(operationalWrites)
      .values({
        writeId: write.writeId,
        venueId: write.venueId,
        generation: write.generation,
      })
      .onConflictDoNothing();
  }

  async countByWriteId(writeId: string): Promise<number> {
    const rows = await this.database
      .select({ writeId: operationalWrites.writeId })
      .from(operationalWrites)
      .where(eq(operationalWrites.writeId, writeId));

    return rows.length;
  }
}
