import type { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { Check } from "#domain/check.js";
import {
  type DiningTable,
  TableAlreadyOccupied,
} from "#domain/dining-table.js";

export interface OpenTableInput {
  tenantId: string;
  venueId: string;
  tableId: string;
  checkId: string;
  diners: number;
}

export interface OpenedTable {
  table: DiningTable;
  check: Check;
}

export class OpenTable {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: OpenTableInput): Promise<OpenedTable> {
    const table = await this.diningRoom.load(
      input.tenantId,
      input.venueId,
      input.tableId,
    );

    if (table === null) {
      throw new TableAlreadyOccupied();
    }

    if (table.state !== "free") {
      table.open({ diners: input.diners });
    }

    const check = Check.open({
      id: input.checkId,
      tenantId: table.tenantId,
      venueId: table.venueId,
      tableId: table.id,
      openedAt: new Date(this.clock.now()).toISOString(),
    });

    table.open({ diners: input.diners });
    await this.diningRoom.save(table);

    return { table, check };
  }
}
