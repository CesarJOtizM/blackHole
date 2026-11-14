import type { ExplodeRecipe } from "#application/explode-recipe/explode-recipe.js";
import type {
  AvailabilityChanged,
  AvailabilityPublisher,
} from "#application/ports/availability-publisher.js";
import type { LowUnitsThreshold } from "#application/ports/low-units-threshold.js";
import type { PointOfSaleDirectory } from "#application/ports/point-of-sale-directory.js";
import type {
  ProducibleProduct,
  ProducibleProjection,
  ProducibleQuantityRepository,
} from "#application/ports/producible-quantity-repository.js";
import type { StockLedgerRepository } from "#application/ports/stock-ledger-repository.js";
import type { SupplyingLocations } from "#application/ports/supplying-locations.js";
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import { UnknownVenue } from "#application/view-theoretical-cost/view-theoretical-cost.js";
import { possibleUnits } from "#domain/producible-quantity.js";
import {
  type ExplodedQuantity,
  UnknownRecipe,
} from "#domain/recipe-catalog.js";

export interface ProjectStockChange {
  kind: "stock";
  tenantId: string;
  siteId: string;
  locationId: string;
  ingredientId: string;
}

export interface ProjectRecipeVersion {
  kind: "recipe";
  tenantId: string;
  siteId: string;
  productId: string;
  variantId?: string;
}

export type ProjectProducibleQuantityInput =
  | ProjectStockChange
  | ProjectRecipeVersion;

const activeIngredientIds = (lines: readonly ExplodedQuantity[]): string[] =>
  lines.flatMap((line) => (line.quantity > 0 ? [line.ingredientId] : []));

export class ProjectProducibleQuantity {
  constructor(
    private readonly recipes: ExplodeRecipe,
    private readonly venues: VenueDirectory,
    private readonly points: PointOfSaleDirectory,
    private readonly ledger: StockLedgerRepository,
    private readonly projections: ProducibleQuantityRepository,
    private readonly supplying: SupplyingLocations,
    private readonly thresholds: LowUnitsThreshold,
    private readonly publisher: AvailabilityPublisher,
  ) {}

  async execute(input: ProjectProducibleQuantityInput): Promise<void> {
    if (input.kind === "recipe") {
      await this.projectRecipe(input);
      return;
    }

    await this.projectStock(input);
  }

  private async projectRecipe(input: ProjectRecipeVersion): Promise<void> {
    const product = {
      productId: input.productId,
      variantId: input.variantId ?? null,
    };
    const lines = await this.explode(input.tenantId, input.siteId, product);

    if (lines === null || activeIngredientIds(lines).length === 0) {
      return;
    }

    await this.projections.replaceIndex(
      input.tenantId,
      input.siteId,
      product,
      activeIngredientIds(lines),
    );
    await this.recalculate(
      input.tenantId,
      input.siteId,
      product,
      lines,
      "point",
    );
  }

  private async projectStock(input: ProjectStockChange): Promise<void> {
    const products = await this.projections.productsFor(
      input.tenantId,
      input.siteId,
      input.ingredientId,
    );

    if (products.length === 0) {
      return;
    }

    const pointLocationId = await this.points.locationOf(
      input.tenantId,
      input.siteId,
    );
    const supplyingIds = await this.supplying.locationIds(
      input.tenantId,
      input.siteId,
    );
    const atPoint = input.locationId === pointLocationId;

    if (!atPoint && !supplyingIds.includes(input.locationId)) {
      return;
    }

    for (const product of products) {
      const lines = await this.explode(input.tenantId, input.siteId, product);

      if (lines === null || activeIngredientIds(lines).length === 0) {
        continue;
      }

      await this.recalculate(
        input.tenantId,
        input.siteId,
        product,
        lines,
        atPoint ? "point" : "warehouse",
      );
    }
  }

  private async explode(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
  ): Promise<readonly ExplodedQuantity[] | null> {
    const brandId = await this.venues.brandOf(tenantId, siteId);

    if (brandId === null) {
      throw new UnknownVenue();
    }

    try {
      return await this.recipes.execute({
        tenantId,
        brandId,
        productId: product.productId,
        ...(product.variantId === null ? {} : { variantId: product.variantId }),
      });
    } catch (error: unknown) {
      if (error instanceof UnknownRecipe) {
        return null;
      }

      throw error;
    }
  }

  private async recalculate(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
    lines: readonly ExplodedQuantity[],
    mode: "point" | "warehouse",
  ): Promise<void> {
    const pointLocationId = await this.points.locationOf(tenantId, siteId);
    const supplyingIds = await this.supplying.locationIds(tenantId, siteId);
    const pointBalances = new Map<string, number>();
    const supplyingBalances = new Map<string, number>();

    for (const line of lines) {
      if (line.quantity <= 0) {
        continue;
      }

      pointBalances.set(
        line.ingredientId,
        await this.ledger.balance(tenantId, pointLocationId, line.ingredientId),
      );
      let supplyingBalance = 0;

      for (const locationId of supplyingIds) {
        supplyingBalance += await this.ledger.balance(
          tenantId,
          locationId,
          line.ingredientId,
        );
      }

      supplyingBalances.set(line.ingredientId, supplyingBalance);
    }

    const units = possibleUnits({
      lines,
      pointBalances,
      supplyingBalances,
      lowUnitsThreshold: await this.thresholds.thresholdOf(
        tenantId,
        siteId,
        product.productId,
        product.variantId,
      ),
    });
    const previous = await this.projections.find(tenantId, siteId, product);

    if (mode === "warehouse") {
      if (previous === null) {
        return;
      }

      await this.projections.save(tenantId, {
        ...previous,
        replenishmentUnits: units.replenishmentUnits,
      });
      return;
    }

    const next: ProducibleProjection = {
      siteId,
      productId: product.productId,
      variantId: product.variantId,
      pointUnits: units.pointUnits,
      replenishmentUnits: units.replenishmentUnits,
      limitingIngredientIds: units.limitingIngredientIds,
      state: units.state,
    };

    await this.projections.save(tenantId, next);

    if (previous !== null && previous.state === next.state) {
      return;
    }

    const notice: AvailabilityChanged = {
      siteId,
      productId: product.productId,
      variantId: product.variantId,
      state: next.state,
    };

    await this.publisher.publish(notice);
  }
}
