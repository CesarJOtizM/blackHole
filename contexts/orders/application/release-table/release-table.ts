import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  type DiningTable,
  TableAlreadyOccupied,
} from "#domain/dining-table.js";

export interface ReleaseTableInput {
  tenantId: string;
  venueId: string;
  tableId: string;
}

const loadTable = async (
  diningRoom: DiningRoomRepository,
  input: ReleaseTableInput,
): Promise<DiningTable> => {
  const table = await diningRoom.load(
    input.tenantId,
    input.venueId,
    input.tableId,
  );

  if (table === null) {
    throw new TableAlreadyOccupied();
  }

  return table;
};

export class ReleaseTable {
  constructor(private readonly diningRoom: DiningRoomRepository) {}

  async execute(input: ReleaseTableInput): Promise<DiningTable> {
    const table = await loadTable(this.diningRoom, input);

    table.release();
    await this.diningRoom.save(table);

    return table;
  }
}

export class MarkTableReady {
  constructor(private readonly diningRoom: DiningRoomRepository) {}

  async execute(input: ReleaseTableInput): Promise<DiningTable> {
    const table = await loadTable(this.diningRoom, input);

    table.markReady();
    await this.diningRoom.save(table);

    return table;
  }
}
