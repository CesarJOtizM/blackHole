import {
  type OperatingMode,
  type OperationOwner,
  VenueOperation,
} from "../../domain/venue-operation.js";
import type { VenueOperationRepository } from "../ports/venue-operation-repository.js";

export interface AcceptCloudWriteCommand {
  venueId: string;
  writeId: string;
  generation: number;
}

export interface AcceptedCloudWrite {
  venueId: string;
  writeId: string;
  mode: OperatingMode;
  operationOwner: OperationOwner;
  generation: number;
}

export class AcceptCloudWrite {
  constructor(private readonly venueOperations: VenueOperationRepository) {}

  async execute(command: AcceptCloudWriteCommand): Promise<AcceptedCloudWrite> {
    const existing = await this.venueOperations.findByVenueId(command.venueId);
    const operation = existing ?? VenueOperation.openCloud(command.venueId);

    operation.acceptWrite(command.generation);

    if (existing === null) {
      await this.venueOperations.save(operation);
    }

    await this.venueOperations.saveWrite({
      writeId: command.writeId,
      venueId: command.venueId,
      generation: command.generation,
    });

    return {
      venueId: operation.venueId,
      writeId: command.writeId,
      mode: operation.mode,
      operationOwner: operation.operationOwner,
      generation: operation.generation,
    };
  }
}
