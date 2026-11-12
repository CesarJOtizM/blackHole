import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { Check } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const cloneField = (field: unknown): unknown =>
  field === undefined ? undefined : structuredClone(field);

const cloneEntity = <T extends object>(entity: T): T => {
  const copy = Object.create(Object.getPrototypeOf(entity)) as T;

  for (const key of Reflect.ownKeys(entity)) {
    if (typeof key !== "string") {
      continue;
    }

    (copy as Record<string, unknown>)[key] = cloneField(
      (entity as Record<string, unknown>)[key],
    );
  }

  return copy;
};

const tableKey = (tenantId: string, venueId: string, tableId: string): string =>
  `${tenantId}\u0000${venueId}\u0000${tableId}`;

const checkKey = (tenantId: string, venueId: string, checkId: string): string =>
  `${tenantId}\u0000${venueId}\u0000${checkId}`;

export class InMemoryDiningRoomRepository extends DiningRoomRepository {
  private readonly tables = new Map<string, DiningTable>();
  private readonly checks = new Map<string, Check>();

  override async load(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<DiningTable | null> {
    const table = this.tables.get(tableKey(tenantId, venueId, tableId));

    return table === undefined ? null : cloneEntity(table);
  }

  override async save(table: DiningTable): Promise<void> {
    this.tables.set(
      tableKey(table.tenantId, table.venueId, table.id),
      cloneEntity(table),
    );
  }

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    const check = this.checks.get(checkKey(tenantId, venueId, checkId));

    return check === undefined ? null : cloneEntity(check);
  }

  override async saveCheck(check: Check): Promise<void> {
    await this.saveChecks([check]);
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    const copies = checks.map((check) => ({
      key: checkKey(check.tenantId, check.venueId, check.id),
      check: cloneEntity(check),
    }));

    for (const copy of copies) {
      this.checks.set(copy.key, copy.check);
    }
  }

  override async listTables(
    tenantId: string,
    venueId: string,
  ): Promise<readonly DiningTable[]> {
    return [...this.tables.values()]
      .filter(
        (table) => table.tenantId === tenantId && table.venueId === venueId,
      )
      .map((table) => cloneEntity(table));
  }

  override async listChecks(
    tenantId: string,
    venueId: string,
  ): Promise<readonly Check[]> {
    return [...this.checks.values()]
      .filter(
        (check) => check.tenantId === tenantId && check.venueId === venueId,
      )
      .map((check) => cloneEntity(check));
  }

  override async loadOpenCheckByTable(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<Check | null> {
    const open = [...this.checks.values()].find(
      (check) =>
        check.tenantId === tenantId &&
        check.venueId === venueId &&
        check.tableId === tableId &&
        (check.tableState === "occupied" ||
          check.tableState === "check_requested"),
    );

    return open === undefined ? null : cloneEntity(open);
  }
}
