import type { CashCount } from "#domain/cash-count.js";

export abstract class CashCountStore {
  abstract find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<CashCount | null>;

  abstract save(
    tenantId: string,
    venueId: string,
    registerId: string,
    count: CashCount,
  ): Promise<void>;
}
