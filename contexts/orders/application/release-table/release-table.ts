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
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly clock: Clock = new WallClock(),
  ) {}

  async execute(input: ReleaseTableInput): Promise<DiningTable> {
    const table = await loadTable(this.diningRoom, input);
    const check = await this.diningRoom.loadOpenCheckByTable(
      input.tenantId,
      input.venueId,
      input.tableId,
    );
    const releasedAt = new Date(this.clock.now()).toISOString();

    table.release();

    if (check !== null) {
      check.stampReleased({ releasedAt });
    }

    await this.diningRoom.save(table);

    if (check !== null) {
      await this.diningRoom.saveCheck(check);
    }

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
