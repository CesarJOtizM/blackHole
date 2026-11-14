import type {
  ConsumptionRole,
  LedgerLine,
} from "#application/ports/stock-ledger-repository.js";
import type { MovementType } from "#domain/stock-ledger.js";

export const STOCK_MOVEMENT_LANE = "after_sales" as const;

export interface StockMovedEvent {
  type: "StockMoved";
  movementId: string;
  tenantId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  movementType: MovementType;
  orderLineId: string;
  recipeVersion: number;
  occurredAt: string;
  role: ConsumptionRole;
}

export interface StockMovementEnvelope {
  lane: typeof STOCK_MOVEMENT_LANE;
  key: string;
  event: StockMovedEvent;
}

export abstract class StockMovementQueue {
  abstract enqueue(envelope: StockMovementEnvelope): Promise<void>;
}

export const stockMovedEvent = (movement: LedgerLine): StockMovedEvent => ({
  type: "StockMoved",
  movementId: movement.id,
  tenantId: movement.tenantId,
  venueId: movement.venueId,
  locationId: movement.locationId,
  ingredientId: movement.ingredientId,
  quantity: movement.quantity,
  unitCost: movement.unitCost,
  movementType: movement.type,
  orderLineId: movement.orderLineId,
  recipeVersion: movement.recipeVersion,
  occurredAt: movement.occurredAt,
  role: movement.role,
});
