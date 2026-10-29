import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { DiningTable } from "#domain/dining-table.js";

export interface PlaceTableInput {
  id: string;
  tenantId: string;
  venueId: string;
  zone: string;
}

export class PlaceTable {
  constructor(private readonly diningRoom: DiningRoomRepository) {}

  async execute(input: PlaceTableInput): Promise<DiningTable> {
    const table = DiningTable.place(input);

    await this.diningRoom.save(table);

    return table;
  }
}
