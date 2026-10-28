import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { DiningTable, TableState } from "#domain/dining-table.js";

export interface ViewTableMapInput {
  tenantId: string;
  venueId: string;
}

export interface TableMapTable {
  id: string;
  state: TableState;
  diners: number;
}

export interface TableMapZone {
  zone: string;
  tables: readonly TableMapTable[];
}

export interface TableMap {
  zones: readonly TableMapZone[];
}

const belongs = (
  table: DiningTable,
  tenantId: string,
  venueId: string,
): boolean => table.tenantId === tenantId && table.venueId === venueId;

const groupByZone = (tables: readonly DiningTable[]): TableMapZone[] => {
  const groups = new Map<string, TableMapTable[]>();

  for (const table of tables) {
    const grouped = groups.get(table.zone) ?? [];

    grouped.push({
      id: table.id,
      state: table.state,
      diners: table.diners,
    });
    groups.set(table.zone, grouped);
  }

  return [...groups.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([zone, grouped]) => ({
      zone,
      tables: [...grouped].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }));
};

export class ViewTableMap {
  constructor(private readonly diningRoom: DiningRoomRepository) {}

  async execute(input: ViewTableMapInput): Promise<TableMap> {
    const listed = await this.diningRoom.listTables(
      input.tenantId,
      input.venueId,
    );

    return {
      zones: groupByZone(
        listed.filter((table) => belongs(table, input.tenantId, input.venueId)),
      ),
    };
  }
}
