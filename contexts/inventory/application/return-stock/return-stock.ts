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
import { MOVEMENT_TYPE, StockLedger } from "#domain/stock-ledger.js";

export interface ReturnStockInput {
  tenantId: string;
  venueId: string;
  generation: number;
  orderLineId: string;
  productId: string;
  variantIds: readonly string[];
  modifierIds: readonly string[];
  portions: number;
  occurredAt: string;
}

export class LineReversalConflict extends Error {
  readonly unitCost: number;

  constructor(unitCost: number) {
    super("This order line was already reversed another way.");
    this.name = "LineReversalConflict";
    this.unitCost = unitCost;
  }
}

const reversalId = (orderLineId: string, ingredientId: string): string =>
  `movement_${orderLineId}_reversal_${ingredientId}`;

export class ReturnStock {
  constructor(
    private readonly generations: OperationGeneration,
    private readonly ledger: StockLedgerRepository,
    private readonly queue: StockMovementQueue,
  ) {}

  async execute(input: ReturnStockInput): Promise<SaleStockResult> {
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
    const other = reversal.find(
      (line) => line.type !== MOVEMENT_TYPE.SALE_RETURN,
    );

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

    const movements = reversedLines(input, consumption, locationId);
    await this.ledger.append({ movements, alerts: [] });

    for (const movement of movements) {
      await this.queue.enqueue({
        lane: STOCK_MOVEMENT_LANE,
        key: movement.id,
        event: stockMovedEvent(movement),
      });
    }

    return { missingRecipe: false };
  }
}

const reversedLines = (
  input: ReturnStockInput,
  consumption: readonly LedgerLine[],
  locationId: string,
): LedgerLine[] => {
  const aggregate = StockLedger.open({
    tenantId: input.tenantId,
    locationId,
  });

  for (const line of consumption) {
    aggregate.append({
      id: line.id,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      type: line.type,
      reference: line.reference,
      occurredAt: line.occurredAt,
    });
  }

  const movements: LedgerLine[] = [];

  for (const line of consumption) {
    const id = reversalId(input.orderLineId, line.ingredientId);
    aggregate.reverse({
      id,
      movementId: line.id,
      reference: input.orderLineId,
      occurredAt: input.occurredAt,
    });
    const created = aggregate.movements.find((movement) => movement.id === id);

    if (!created?.reversesMovementId) {
      throw new LineReversalConflict(line.unitCost);
    }

    movements.push({
      id: created.id,
      tenantId: input.tenantId,
      venueId: input.venueId,
      locationId: created.locationId,
      ingredientId: created.ingredientId,
      quantity: created.quantity,
      unitCost: created.unitCost,
      type: created.type,
      reference: created.reference,
      occurredAt: created.occurredAt,
      orderLineId: input.orderLineId,
      role: CONSUMPTION_ROLE.REVERSAL,
      recipeVersion: line.recipeVersion,
      reason: null,
      actorId: null,
      reversesMovementId: created.reversesMovementId,
    });
  }

  return movements;
};
