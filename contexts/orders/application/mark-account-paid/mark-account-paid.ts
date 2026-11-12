import { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  type DiningTable,
  TableAlreadyOccupied,
} from "#domain/dining-table.js";

class WallClock extends Clock {
  override now(): number {
    return Date.now();
  }
}

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
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly clock: Clock = new WallClock(),
  ) {}

  async execute(input: MarkAccountPaidInput): Promise<DiningTable> {
    const table = await loadTable(this.diningRoom, input);

    if (table.state === "to_clean") {
      return table;
    }

    const check = await this.diningRoom.loadOpenCheckByTable(
      input.tenantId,
      input.venueId,
      input.tableId,
    );
    const chargedAt = new Date(this.clock.now()).toISOString();

    table.release();

    if (check !== null) {
      check.stampCharged({ chargedAt });
    }

    await this.diningRoom.save(table);

    if (check !== null) {
      await this.diningRoom.saveCheck(check);
    }

    return table;
  }
}
