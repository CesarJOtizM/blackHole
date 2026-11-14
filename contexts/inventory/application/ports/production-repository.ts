import type { NegativeStockOpenedEvent } from "#application/ports/stock-alert-publisher.js";
import type { ProductionCostRule } from "#domain/production.js";
import type { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

export interface ProductionStockLine {
  id: string;
  tenantId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type:
    | typeof MOVEMENT_TYPE.PRODUCTION_CONSUMPTION
    | typeof MOVEMENT_TYPE.PRODUCTION_OUTPUT;
  reference: string;
  occurredAt: string;
  actorId: string;
  orderLineId: null;
  role: null;
  recipeVersion: number;
}

export interface RecordedProductionRun {
  runId: string;
  tenantId: string;
  venueId: string;
  locationId: string;
  recipeId: string;
  recipeVersion: number;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  outputUnitCost: number | null;
  movements: readonly ProductionStockLine[];
}

export interface ProductionCostPolicy {
  costRule: ProductionCostRule;
  standardUnitCost: number | null;
}

export interface AppendProduction {
  run: RecordedProductionRun;
  alerts: readonly NegativeStockOpenedEvent[];
}

export interface ProductionCompensationLine extends ProductionStockLine {
  reversesMovementId: string;
}

export interface AppendProductionCompensation {
  tenantId: string;
  originalRunId: string;
  correctionRunId: string;
  movements: readonly ProductionCompensationLine[];
}

export interface ProductionCostPreparation {
  recipeId: string;
  standardUnitCost: number;
}

export interface SaveProductionCostPolicy {
  tenantId: string;
  costRule: ProductionCostRule;
  preparations: readonly ProductionCostPreparation[];
}

export abstract class ProductionRepository {
  abstract findRun(
    tenantId: string,
    runId: string,
  ): Promise<RecordedProductionRun | null>;

  abstract balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;

  abstract averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;

  abstract hasOpenAlert(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<boolean>;

  abstract policyFor(
    tenantId: string,
    recipeId: string,
  ): Promise<ProductionCostPolicy | null>;

  abstract append(input: AppendProduction): Promise<void>;

  findCompensation(
    tenantId: string,
    originalRunId: string,
  ): Promise<AppendProductionCompensation | null> {
    void tenantId;
    void originalRunId;
    return Promise.resolve(null);
  }

  appendCompensation(input: AppendProductionCompensation): Promise<void> {
    return Promise.reject(
      new Error(
        `Production compensation is not stored for ${input.originalRunId}.`,
      ),
    );
  }

  saveCostPolicy(input: SaveProductionCostPolicy): Promise<void> {
    return Promise.reject(
      new Error(`Production cost policy is not stored for ${input.tenantId}.`),
    );
  }
}
