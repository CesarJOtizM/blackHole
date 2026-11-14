import type { MovementType } from "#domain/stock-ledger.js";

export const COUNT_LINE_ROLE = {
  CONSUMPTION: "consumption",
  REVERSAL: "reversal",
  OPERATIONAL_WASTE: "operational_waste",
  COUNT_ADJUSTMENT: "count_adjustment",
} as const;

export type CountLineRole =
  (typeof COUNT_LINE_ROLE)[keyof typeof COUNT_LINE_ROLE];

export interface CountLedgerLine {
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
  role: CountLineRole;
  recipeVersion: number;
  reason: string | null;
  actorId: string | null;
  reversesMovementId?: string;
}

export const COUNT_SESSION_STATUS = {
  POSTED: "posted",
  PENDING: "pending",
} as const;

export type CountSessionStatus =
  (typeof COUNT_SESSION_STATUS)[keyof typeof COUNT_SESSION_STATUS];

export interface CountSessionLine {
  ingredientId: string;
  quantity: number;
  averageCost: number;
  valueCop: number;
}

export interface CountSession {
  tenantId: string;
  venueId: string;
  locationId: string;
  documentId: string;
  cutOff: string;
  status: CountSessionStatus;
  lines: readonly CountSessionLine[];
  valueCop: number;
}

export abstract class StockCountRepository {
  abstract movementsAt(
    tenantId: string,
    venueId: string,
    locationId: string,
  ): Promise<readonly CountLedgerLine[]>;

  abstract appendAdjustments(lines: readonly CountLedgerLine[]): Promise<void>;

  abstract saveSession(session: CountSession): Promise<void>;
}
