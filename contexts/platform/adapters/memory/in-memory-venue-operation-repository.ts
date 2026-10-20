import type { OperationalWrite } from "../../application/ports/venue-operation-repository.js";
import { VenueOperationRepository } from "../../application/ports/venue-operation-repository.js";
import type { VenueOperation } from "../../domain/venue-operation.js";

export class InMemoryVenueOperationRepository extends VenueOperationRepository {
  private readonly operations = new Map<string, VenueOperation>();
  private readonly writes = new Map<string, OperationalWrite>();

  override async save(operation: VenueOperation): Promise<void> {
    this.operations.set(operation.venueId, operation);
  }

  override async findByVenueId(
    venueId: string,
  ): Promise<VenueOperation | null> {
    return this.operations.get(venueId) ?? null;
  }

  override async saveWrite(write: OperationalWrite): Promise<void> {
    if (this.writes.has(write.writeId)) {
      return;
    }

    this.writes.set(write.writeId, write);
  }

  async countByWriteId(writeId: string): Promise<number> {
    return this.writes.has(writeId) ? 1 : 0;
  }
}
