import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { type Check, TableNotOpen } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

interface ReassignCheckBase {
  tenantId: string;
  venueId: string;
  targetCheckId: string;
  sourceCheckId: string;
}

export type ReassignCheckInput =
  | (ReassignCheckBase & { kind: "join" })
  | (ReassignCheckBase & {
      kind: "transfer";
      lineIds: readonly string[];
    });

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  tenantId: string,
  venueId: string,
  checkId: string,
): Promise<Check> => {
  const check = await diningRoom.loadCheck(tenantId, venueId, checkId);

  if (check === null) {
    throw new TableNotOpen();
  }

  return check;
};

const loadTable = async (
  diningRoom: DiningRoomRepository,
  tenantId: string,
  venueId: string,
  tableId: string,
): Promise<DiningTable> => {
  const table = await diningRoom.load(tenantId, venueId, tableId);

  if (table === null) {
    throw new TableNotOpen();
  }

  return table;
};

export class ReassignCheck {
  constructor(private readonly diningRoom: DiningRoomRepository) {}

  async execute(input: ReassignCheckInput): Promise<Check> {
    const target = await loadCheck(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      input.targetCheckId,
    );
    const source = await loadCheck(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      input.sourceCheckId,
    );
    const targetTable = await loadTable(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      target.tableId,
    );
    const sourceTable = await loadTable(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      source.tableId,
    );

    if (input.kind === "join") {
      target.join({
        source,
        sourceState: sourceTable.state,
        targetState: targetTable.state,
      });
    } else {
      target.transfer({
        source,
        lineIds: input.lineIds,
        sourceState: sourceTable.state,
        targetState: targetTable.state,
      });
    }

    await this.diningRoom.saveChecks([target, source]);

    return target;
  }
}
