import type { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { type Check, TableNotOpen } from "#domain/check.js";
import {
  type DiningTable,
  TableAlreadyOccupied,
} from "#domain/dining-table.js";

export interface RequestCheckInput {
  tenantId: string;
  venueId: string;
  checkId: string;
}

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  input: RequestCheckInput,
): Promise<Check> => {
  const check = await diningRoom.loadCheck(
    input.tenantId,
    input.venueId,
    input.checkId,
  );

  if (check === null) {
    throw new TableNotOpen();
  }

  return check;
};

const loadTable = async (
  diningRoom: DiningRoomRepository,
  check: Check,
): Promise<DiningTable> => {
  const table = await diningRoom.load(
    check.tenantId,
    check.venueId,
    check.tableId,
  );

  if (table === null) {
    throw new TableAlreadyOccupied();
  }

  return table;
};

export class RequestCheck {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RequestCheckInput): Promise<Check> {
    const check = await loadCheck(this.diningRoom, input);
    const table = await loadTable(this.diningRoom, check);

    if (check.tableState !== "occupied") {
      check.requestCheck();
    }

    if (table.state !== "occupied") {
      table.requestCheck();
    }

    const requestedAt = new Date(this.clock.now()).toISOString();

    check.requestCheck({ requestedAt });
    table.requestCheck();
    await this.diningRoom.save(table);
    await this.diningRoom.saveCheck(check);

    return check;
  }
}
