import type { VenueOperation } from "#domain/venue-operation.js";

export interface OperationalWrite {
  writeId: string;
  venueId: string;
  generation: number;
}

export abstract class VenueOperationRepository {
  abstract save(operation: VenueOperation): Promise<void>;

  abstract findByVenueId(venueId: string): Promise<VenueOperation | null>;

  abstract saveWrite(write: OperationalWrite): Promise<void>;
}
