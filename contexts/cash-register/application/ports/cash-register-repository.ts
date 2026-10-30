import type { CashShift } from "#domain/cash-shift.js";

export abstract class CashRegisterRepository {
  abstract load(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<CashShift | null>;

  abstract save(
    tenantId: string,
    venueId: string,
    shift: CashShift,
  ): Promise<void>;
}
