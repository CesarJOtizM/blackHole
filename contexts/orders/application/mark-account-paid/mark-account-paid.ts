import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  type DiningTable,
  TableAlreadyOccupied,
} from "#domain/dining-table.js";

export interface MarkAccountPaidInput {
  tenantId: string;
  venueId: string;
  tableId: string;
}

const loadTable = async (
  diningRoom: DiningRoomRepository,
  input: MarkAccountPaidInput,
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

export class MarkAccountPaid {
  constructor(private readonly diningRoom: DiningRoomRepository) {}

  async execute(input: MarkAccountPaidInput): Promise<DiningTable> {
    const table = await loadTable(this.diningRoom, input);

    if (table.state === "to_clean") {
      return table;
    }

    table.release();
    await this.diningRoom.save(table);

    return table;
  }
}
