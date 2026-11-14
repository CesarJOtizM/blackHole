import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

import type { OperationGeneration } from "#application/ports/operation-generation.js";
import {
  CONSUMPTION_ROLE,
  type LedgerLine,
  type StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import {
  STOCK_MOVEMENT_LANE,
  type StockMovementQueue,
  stockMovedEvent,
} from "#application/ports/stock-movement-queue.js";
import type { SaleStockResult } from "#application/register-sale-consumption/register-sale-consumption.js";
import { LineReversalConflict } from "#application/return-stock/return-stock.js";
import { MOVEMENT_TYPE, StockLedger } from "#domain/stock-ledger.js";

const WASTE_AUDIT = "inventory.record-waste";

export interface RecordWasteInput {
  tenantId: string;
  venueId: string;
  generation: number;
  orderLineId: string;
  productId: string;
  variantIds: readonly string[];
  modifierIds: readonly string[];
  portions: number;
  occurredAt: string;
  actorId: string;
  reason: string;
}

const reversalId = (orderLineId: string, ingredientId: string): string =>
  `movement_${orderLineId}_reversal_${ingredientId}`;

export class RecordWaste {
  constructor(
    private readonly generations: OperationGeneration,
    private readonly ledger: StockLedgerRepository,
    private readonly queue: StockMovementQueue,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: RecordWasteInput): Promise<SaleStockResult> {
    await this.generations.assertCurrent(
      input.tenantId,
      input.venueId,
      input.generation,
    );

    const [reversal, consumption] = await Promise.all([
      this.ledger.findLine(
        input.tenantId,
        input.orderLineId,
        CONSUMPTION_ROLE.REVERSAL,
      ),
      this.ledger.findLine(
        input.tenantId,
        input.orderLineId,
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ]);
    const other = reversal.find((line) => line.type !== MOVEMENT_TYPE.WASTE);

    if (other) {
      const stored = consumption.find(
        (line) => line.ingredientId === other.ingredientId,
      );
      throw new LineReversalConflict(stored?.unitCost ?? other.unitCost);
    }

    if (reversal.length > 0 || consumption.length === 0) {
      return { missingRecipe: consumption.length === 0 };
    }

    const locationId = consumption[0]?.locationId;

    if (locationId === undefined) {
      return { missingRecipe: true };
    }

    const movements = wastedLines(input, consumption, locationId);
    await this.ledger.append({ movements, alerts: [] });

    for (const movement of movements) {
      await this.queue.enqueue({
        lane: STOCK_MOVEMENT_LANE,
        key: movement.id,
        event: stockMovedEvent(movement),
      });
    }

    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: null,
      deviceId: input.venueId,
      siteId: input.venueId,
      action: WASTE_AUDIT,
      entity: input.orderLineId,
      before: {
        recipeVersion: consumption[0]?.recipeVersion ?? null,
      },
      after: {
        movementIds: movements.map((movement) => movement.id),
      },
      reason: input.reason,
    });

    return { missingRecipe: false };
  }
}

const wastedLines = (
  input: RecordWasteInput,
  consumption: readonly LedgerLine[],
  locationId: string,
): LedgerLine[] => {
  const aggregate = StockLedger.open({
    tenantId: input.tenantId,
    locationId,
  });
  const movements: LedgerLine[] = [];

  for (const line of consumption) {
    const id = reversalId(input.orderLineId, line.ingredientId);
    aggregate.append({
      id,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      type: MOVEMENT_TYPE.WASTE,
      reference: input.orderLineId,
      occurredAt: input.occurredAt,
    });
    movements.push({
      id,
      tenantId: input.tenantId,
      venueId: input.venueId,
      locationId,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      type: MOVEMENT_TYPE.WASTE,
      reference: input.orderLineId,
      occurredAt: input.occurredAt,
      orderLineId: input.orderLineId,
      role: CONSUMPTION_ROLE.REVERSAL,
      recipeVersion: line.recipeVersion,
      reason: input.reason,
      actorId: input.actorId,
      reversesMovementId: line.id,
    });
  }

  return movements;
};
