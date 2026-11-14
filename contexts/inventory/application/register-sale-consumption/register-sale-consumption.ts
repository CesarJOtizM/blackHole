import type { ExplodeRecipe } from "#application/explode-recipe/explode-recipe.js";
import type { OperationGeneration } from "#application/ports/operation-generation.js";
import type { PointOfSaleDirectory } from "#application/ports/point-of-sale-directory.js";
import type { RecipeVersionReader } from "#application/ports/recipe-version.js";
import type { ReferenceCostList } from "#application/ports/reference-cost.js";
import type {
  NegativeStockOpenedEvent,
  StockAlertPublisher,
} from "#application/ports/stock-alert-publisher.js";
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
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import { UnknownVenue } from "#application/view-theoretical-cost/view-theoretical-cost.js";
import {
  type ExplodedQuantity,
  UnknownRecipe,
} from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE, StockLedger } from "#domain/stock-ledger.js";

export interface RegisterSaleConsumptionInput {
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

export interface SaleStockResult {
  missingRecipe: boolean;
}

const movementId = (orderLineId: string, ingredientId: string): string =>
  `movement_${orderLineId}_consumption_${ingredientId}`;

export class RegisterSaleConsumption {
  constructor(
    private readonly recipes: ExplodeRecipe,
    private readonly versions: RecipeVersionReader,
    private readonly costs: ReferenceCostList,
    private readonly venues: VenueDirectory,
    private readonly pointsOfSale: PointOfSaleDirectory,
    private readonly generations: OperationGeneration,
    private readonly ledger: StockLedgerRepository,
    private readonly alerts: StockAlertPublisher,
    private readonly queue: StockMovementQueue,
  ) {}

  async execute(input: RegisterSaleConsumptionInput): Promise<SaleStockResult> {
    await this.generations.assertCurrent(
      input.tenantId,
      input.venueId,
      input.generation,
    );

    const existing = await this.ledger.findLine(
      input.tenantId,
      input.orderLineId,
      CONSUMPTION_ROLE.CONSUMPTION,
    );

    if (existing.length > 0) {
      return { missingRecipe: false };
    }

    const brandId = await this.venues.brandOf(input.tenantId, input.venueId);

    if (brandId === null) {
      throw new UnknownVenue();
    }

    const version = await this.versions.current({
      tenantId: input.tenantId,
      brandId,
      productId: input.productId,
      variantIds: input.variantIds,
    });

    if (version === null) {
      return { missingRecipe: true };
    }

    const exploded = await this.explode(input, brandId, version);

    if (exploded === null) {
      return { missingRecipe: true };
    }

    const locationId = await this.pointsOfSale.locationOf(
      input.tenantId,
      input.venueId,
    );
    const draft = StockLedger.open({
      tenantId: input.tenantId,
      locationId,
    });
    const movements: LedgerLine[] = [];
    const opened: NegativeStockOpenedEvent[] = [];

    for (const line of exploded) {
      const quantity = -line.quantity * input.portions;

      if (quantity === 0) {
        continue;
      }

      const unitCost = await this.costs.costOf(
        input.tenantId,
        line.ingredientId,
      );
      const id = movementId(input.orderLineId, line.ingredientId);
      draft.append({
        id,
        ingredientId: line.ingredientId,
        quantity,
        unitCost,
        type: MOVEMENT_TYPE.SALE_CONSUMPTION,
        reference: input.orderLineId,
        occurredAt: input.occurredAt,
      });
      const current = await this.ledger.balance(
        input.tenantId,
        locationId,
        line.ingredientId,
      );
      const next = current + quantity;
      const alreadyOpen = await this.ledger.hasOpenAlert(
        input.tenantId,
        locationId,
        line.ingredientId,
      );

      if (next < 0 && !alreadyOpen) {
        opened.push({
          type: "NegativeStockOpened",
          tenantId: input.tenantId,
          venueId: input.venueId,
          locationId,
          ingredientId: line.ingredientId,
          balance: next,
          occurredAt: input.occurredAt,
        });
      }

      movements.push({
        id,
        tenantId: input.tenantId,
        venueId: input.venueId,
        locationId,
        ingredientId: line.ingredientId,
        quantity,
        unitCost,
        type: MOVEMENT_TYPE.SALE_CONSUMPTION,
        reference: input.orderLineId,
        occurredAt: input.occurredAt,
        orderLineId: input.orderLineId,
        role: CONSUMPTION_ROLE.CONSUMPTION,
        recipeVersion: version,
        reason: null,
        actorId: null,
      });
    }

    await this.ledger.append({ movements, alerts: opened });

    for (const alert of opened) {
      await this.alerts.publish(alert);
    }

    for (const movement of movements) {
      await this.queue.enqueue({
        lane: STOCK_MOVEMENT_LANE,
        key: movement.id,
        event: stockMovedEvent(movement),
      });
    }

    return { missingRecipe: false };
  }

  private async explode(
    input: RegisterSaleConsumptionInput,
    brandId: string,
    version: number,
  ): Promise<readonly ExplodedQuantity[] | null> {
    const variantId = input.variantIds[0];

    try {
      return await this.recipes.execute({
        tenantId: input.tenantId,
        brandId,
        productId: input.productId,
        version,
        ...(variantId === undefined ? {} : { variantId }),
        ...(input.modifierIds.length === 0
          ? {}
          : { modifierIds: input.modifierIds }),
      });
    } catch (error: unknown) {
      if (error instanceof UnknownRecipe) {
        return null;
      }

      throw error;
    }
  }
}
