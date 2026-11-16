import type { NegativeStockOpenedEvent } from "#application/ports/stock-alert-publisher.js";
import type { MovementType } from "#domain/stock-ledger.js";

export const CONSUMPTION_ROLE = {
  CONSUMPTION: "consumption",
  REVERSAL: "reversal",
  OPERATIONAL_WASTE: "operational_waste",
  COUNT_ADJUSTMENT: "count_adjustment",
} as const;

export type ConsumptionRole =
  (typeof CONSUMPTION_ROLE)[keyof typeof CONSUMPTION_ROLE];

export interface LedgerLine {
  id: string;
  tenantId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type: MovementType;
  reference: string;
  occurredAt: string;
  orderLineId: string;
  role: ConsumptionRole;
  recipeVersion: number;
  reason: string | null;
  actorId: string | null;
  reversesMovementId?: string;
}

export interface AppendStock {
  movements: readonly LedgerLine[];
  alerts: readonly NegativeStockOpenedEvent[];
}

export abstract class StockLedgerRepository {
  abstract findLine(
    tenantId: string,
    orderLineId: string,
    role: ConsumptionRole,
  ): Promise<readonly LedgerLine[]>;

  abstract balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;

  abstract hasOpenAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<boolean>;

  abstract append(input: AppendStock): Promise<void>;

  abstract listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly LedgerLine[]>;
}
