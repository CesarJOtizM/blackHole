import type { Check } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

export abstract class DiningRoomRepository {
  abstract load(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<DiningTable | null>;

  abstract save(table: DiningTable): Promise<void>;

  abstract loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null>;

  abstract saveCheck(check: Check): Promise<void>;

  abstract saveChecks(checks: readonly Check[]): Promise<void>;

  listTables(
    _tenantId: string,
    _venueId: string,
  ): Promise<readonly DiningTable[]> {
    return Promise.reject(new Error("listTables is not implemented."));
  }

  listChecks(_tenantId: string, _venueId: string): Promise<readonly Check[]> {
    return Promise.reject(new Error("listChecks is not implemented."));
  }

  loadOpenCheckByTable(
    _tenantId: string,
    _venueId: string,
    _tableId: string,
  ): Promise<Check | null> {
    return Promise.resolve(null);
  }
}
