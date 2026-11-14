import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

import type { InventoryLocationDirectory } from "#application/ports/inventory-location-directory.js";
import type {
  ProductionCostPolicy,
  ProductionRepository,
  ProductionStockLine,
  RecordedProductionRun,
} from "#application/ports/production-repository.js";
import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import type { NegativeStockOpenedEvent } from "#application/ports/stock-alert-publisher.js";
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import { UnknownVenue } from "#application/view-theoretical-cost/view-theoretical-cost.js";
import {
  PRODUCTION_COST_RULE,
  type ProductionMovement,
  ProductionRun,
} from "#domain/production.js";
import {
  MissingOutputQuantity,
  QUANTITY_SCALE,
  type RecipeView,
  UnknownRecipe,
} from "#domain/recipe-catalog.js";

const RECORD_PRODUCTION = "inventory.record-production";

export class PreparationNotStocked extends Error {
  constructor() {
    super("A non-stocked preparation cannot be produced.");
    this.name = "PreparationNotStocked";
  }
}

export class MissingProductionCostPolicy extends Error {
  constructor() {
    super("Production needs a consumed average or a standard cost.");
    this.name = "MissingProductionCostPolicy";
  }
}

export class UnknownProductionLocation extends Error {
  constructor() {
    super("The inventory location is not a point of sale or a warehouse.");
    this.name = "UnknownProductionLocation";
  }
}

export interface RecordProductionInput {
  tenantId: string;
  venueId: string;
  locationId: string;
  recipeId: string;
  runId: string;
  expectedQuantity: number;
  actualQuantity: number;
  occurredAt: string;
  actorId: string;
  deviceId: string;
}

const unscale = (quantity: number): number =>
  Math.trunc(quantity / QUANTITY_SCALE);

const scale = (quantity: number): number => quantity * QUANTITY_SCALE;

const isStocked = (recipes: readonly RecipeView[], recipeId: string): boolean =>
  recipes.some((recipe) =>
    recipe.lines.some(
      (line) =>
        line.kind === "recipe" && line.recipeId === recipeId && line.stocked,
    ),
  );

const standardUnitCost = (policy: ProductionCostPolicy): number | undefined => {
  if (
    policy.costRule !== PRODUCTION_COST_RULE.STANDARD ||
    policy.standardUnitCost === null
  ) {
    return undefined;
  }

  return policy.standardUnitCost;
};

export class RecordProduction {
  constructor(
    private readonly catalogs: RecipeCatalogRepository,
    private readonly venues: VenueDirectory,
    private readonly locations: InventoryLocationDirectory,
    private readonly production: ProductionRepository,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: RecordProductionInput): Promise<RecordedProductionRun> {
    const existing = await this.production.findRun(input.tenantId, input.runId);

    if (existing) {
      return existing;
    }

    const location = await this.locations.find(
      input.tenantId,
      input.locationId,
    );

    if (!location) {
      throw new UnknownProductionLocation();
    }

    const brandId = await this.venues.brandOf(input.tenantId, input.venueId);

    if (brandId === null) {
      throw new UnknownVenue();
    }

    const catalog = await this.catalogs.load(input.tenantId, brandId);

    if (catalog === null) {
      throw new UnknownRecipe();
    }

    const recipeVersion = catalog.currentVersion;
    const published = catalog.publishedVersion(recipeVersion);
    const recipe = published.recipes.find((item) => item.id === input.recipeId);

    if (!recipe) {
      throw new UnknownRecipe();
    }

    if (!isStocked(published.recipes, input.recipeId)) {
      throw new PreparationNotStocked();
    }

    const policy = await this.production.policyFor(
      input.tenantId,
      input.recipeId,
    );

    if (!policy) {
      throw new MissingProductionCostPolicy();
    }

    const outputQuantity = recipe.outputQuantity;

    if (outputQuantity === undefined) {
      throw new MissingOutputQuantity();
    }

    const lines: {
      ingredientId: string;
      quantity: number;
      unitCost: number;
    }[] = [];

    for (const line of catalog.explodePreparation({
      recipeId: input.recipeId,
      version: recipeVersion,
    })) {
      const quantity = unscale(line.quantity);

      if (quantity === 0) {
        continue;
      }

      lines.push({
        ingredientId: line.ingredientId,
        quantity,
        unitCost: await this.production.averageCost(
          input.tenantId,
          location.id,
          line.ingredientId,
        ),
      });
    }

    const unitCost = standardUnitCost(policy);
    const recorded = ProductionRun.record({
      runId: input.runId,
      locationId: location.id,
      recipeId: input.recipeId,
      outputQuantity: unscale(outputQuantity),
      expectedQuantity: input.expectedQuantity,
      actualQuantity: input.actualQuantity,
      lines,
      costRule: policy.costRule,
      ...(unitCost === undefined ? {} : { standardUnitCost: unitCost }),
    });
    const movements = recorded.movements.map((movement) =>
      stockLine(input, movement, recipeVersion),
    );
    const alerts = await this.shortages(input, location.id, movements);
    const run: RecordedProductionRun = {
      runId: recorded.runId,
      tenantId: input.tenantId,
      venueId: input.venueId,
      locationId: location.id,
      recipeId: recorded.recipeId,
      recipeVersion,
      expectedQuantity: recorded.expectedQuantity,
      actualQuantity: recorded.actualQuantity,
      variance: recorded.variance,
      outputUnitCost: recorded.outputUnitCost,
      movements,
    };

    await this.production.append({ run, alerts });
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: null,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: RECORD_PRODUCTION,
      entity: input.runId,
      before: null,
      after: {
        runId: run.runId,
        recipeId: run.recipeId,
        recipeVersion: run.recipeVersion,
        locationId: run.locationId,
        expectedQuantity: run.expectedQuantity,
        actualQuantity: run.actualQuantity,
        variance: run.variance,
        outputUnitCost: run.outputUnitCost,
      },
      reason: "production",
    });

    return run;
  }

  private async shortages(
    input: RecordProductionInput,
    locationId: string,
    movements: readonly ProductionStockLine[],
  ): Promise<NegativeStockOpenedEvent[]> {
    const opened: NegativeStockOpenedEvent[] = [];
    const pending = new Map<string, number>();
    const seen = new Set<string>();

    for (const movement of movements) {
      const current = await this.production.balance(
        input.tenantId,
        locationId,
        movement.ingredientId,
      );
      const already = pending.get(movement.ingredientId) ?? 0;
      const next = current + already + movement.quantity;
      pending.set(movement.ingredientId, already + movement.quantity);

      if (next >= 0 || seen.has(movement.ingredientId)) {
        continue;
      }

      const open = await this.production.hasOpenAlert(
        input.tenantId,
        locationId,
        movement.ingredientId,
      );

      if (open) {
        continue;
      }

      seen.add(movement.ingredientId);
      opened.push({
        type: "NegativeStockOpened",
        tenantId: input.tenantId,
        venueId: input.venueId,
        locationId,
        ingredientId: movement.ingredientId,
        balance: next,
        occurredAt: input.occurredAt,
      });
    }

    return opened;
  }
}

function stockLine(
  input: RecordProductionInput,
  movement: ProductionMovement,
  recipeVersion: number,
): ProductionStockLine {
  return {
    id: movement.id,
    tenantId: input.tenantId,
    venueId: input.venueId,
    locationId: movement.locationId,
    ingredientId: movement.ingredientId,
    quantity: scale(movement.quantity),
    unitCost: movement.unitCost,
    type: movement.type,
    reference: input.runId,
    occurredAt: input.occurredAt,
    actorId: input.actorId,
    orderLineId: null,
    role: null,
    recipeVersion,
  };
}
