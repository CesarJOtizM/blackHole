import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

export const PRODUCTION_COST_RULE = {
  CONSUMED_AVERAGE: "consumed_average",
  STANDARD: "standard",
} as const;

export type ProductionCostRule =
  (typeof PRODUCTION_COST_RULE)[keyof typeof PRODUCTION_COST_RULE];

export class InvalidProduction extends Error {
  constructor() {
    super("A production quantity and cost must be whole numbers.");
    this.name = "InvalidProduction";
  }
}

export class ProductionAlreadyCompensated extends Error {
  constructor() {
    super("A production run can be compensated only once.");
    this.name = "ProductionAlreadyCompensated";
  }
}

interface ProductionLine {
  ingredientId: string;
  quantity: number;
  unitCost: number;
}

interface RecordProduction {
  runId: string;
  locationId: string;
  recipeId: string;
  outputQuantity: number;
  expectedQuantity: number;
  actualQuantity: number;
  lines: readonly ProductionLine[];
  costRule: ProductionCostRule;
  standardUnitCost?: number;
}

interface CompensateProduction {
  runId: string;
}

export interface ProductionMovement {
  id: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type:
    | typeof MOVEMENT_TYPE.PRODUCTION_CONSUMPTION
    | typeof MOVEMENT_TYPE.PRODUCTION_OUTPUT;
  reference: string;
  reversesMovementId?: string;
}

interface StoredRun {
  runId: string;
  locationId: string;
  recipeId: string;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  outputUnitCost: number | null;
  movements: ProductionMovement[];
}

export class ProductionRun {
  readonly runId: string;
  readonly locationId: string;
  readonly recipeId: string;
  readonly expectedQuantity: number;
  readonly actualQuantity: number;
  readonly variance: number;
  readonly outputUnitCost: number | null;

  private readonly stored: ProductionMovement[];
  private compensated = false;

  private constructor(run: StoredRun) {
    this.runId = run.runId;
    this.locationId = run.locationId;
    this.recipeId = run.recipeId;
    this.expectedQuantity = run.expectedQuantity;
    this.actualQuantity = run.actualQuantity;
    this.variance = run.variance;
    this.outputUnitCost = run.outputUnitCost;
    this.stored = run.movements;
  }

  static record(input: RecordProduction): ProductionRun {
    assertIdentity(input.runId);
    assertIdentity(input.locationId);
    assertIdentity(input.recipeId);
    assertPositive(input.outputQuantity);
    assertPositive(input.expectedQuantity);
    assertWhole(input.actualQuantity);

    const standardUnitCost = standardCost(input);
    const movements: ProductionMovement[] = [];
    let consumedCost = 0;

    input.lines.forEach((line, index) => {
      assertIdentity(line.ingredientId);
      assertPositive(line.quantity);
      assertWhole(line.unitCost);

      const scaled = Math.floor(
        (line.quantity * input.expectedQuantity) / input.outputQuantity,
      );

      if (scaled === 0) {
        return;
      }

      consumedCost += scaled * line.unitCost;
      movements.push(
        movement({
          id: `${input.runId}:consumption:${index}`,
          locationId: input.locationId,
          ingredientId: line.ingredientId,
          quantity: -scaled,
          unitCost: line.unitCost,
          type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
          reference: input.runId,
        }),
      );
    });

    const outputUnitCost =
      input.actualQuantity === 0
        ? null
        : valuedOutput(
            input.costRule,
            consumedCost,
            input.actualQuantity,
            standardUnitCost,
          );

    if (outputUnitCost !== null) {
      movements.push(
        movement({
          id: `${input.runId}:output`,
          locationId: input.locationId,
          ingredientId: input.recipeId,
          quantity: input.actualQuantity,
          unitCost: outputUnitCost,
          type: MOVEMENT_TYPE.PRODUCTION_OUTPUT,
          reference: input.runId,
        }),
      );
    }

    return new ProductionRun({
      runId: input.runId,
      locationId: input.locationId,
      recipeId: input.recipeId,
      expectedQuantity: input.expectedQuantity,
      actualQuantity: input.actualQuantity,
      variance: input.actualQuantity - input.expectedQuantity,
      outputUnitCost,
      movements,
    });
  }

  get movements(): readonly ProductionMovement[] {
    return this.stored.map(copyMovement);
  }

  compensate(input: CompensateProduction): readonly ProductionMovement[] {
    if (this.compensated) {
      throw new ProductionAlreadyCompensated();
    }

    assertIdentity(input.runId);

    const originals = this.stored.map(copyMovement);
    let consumptionIndex = 0;
    const added = originals.map((original) => {
      const id =
        original.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT
          ? `${input.runId}:output`
          : `${input.runId}:consumption:${consumptionIndex}`;

      if (original.type === MOVEMENT_TYPE.PRODUCTION_CONSUMPTION) {
        consumptionIndex += 1;
      }

      return movement({
        id,
        locationId: original.locationId,
        ingredientId: original.ingredientId,
        quantity: -original.quantity,
        unitCost: original.unitCost,
        type: original.type,
        reference: input.runId,
        reversesMovementId: original.id,
      });
    });

    this.stored.push(...added);
    this.compensated = true;
    return added.map(copyMovement);
  }
}

function valuedOutput(
  costRule: ProductionCostRule,
  consumedCost: number,
  actualQuantity: number,
  standardUnitCost: number | undefined,
): number {
  if (costRule === PRODUCTION_COST_RULE.STANDARD) {
    return standardUnitCost ?? 0;
  }

  return roundHalfUp(consumedCost, actualQuantity);
}

function standardCost(input: RecordProduction): number | undefined {
  if (input.costRule === PRODUCTION_COST_RULE.CONSUMED_AVERAGE) {
    return undefined;
  }

  if (input.costRule !== PRODUCTION_COST_RULE.STANDARD) {
    throw new InvalidProduction();
  }

  if (input.standardUnitCost === undefined) {
    throw new InvalidProduction();
  }

  assertWhole(input.standardUnitCost);
  return input.standardUnitCost;
}

function movement(input: ProductionMovement): ProductionMovement {
  return {
    id: input.id,
    locationId: input.locationId,
    ingredientId: input.ingredientId,
    quantity: input.quantity,
    unitCost: input.unitCost,
    type: input.type,
    reference: input.reference,
    ...(input.reversesMovementId === undefined
      ? {}
      : { reversesMovementId: input.reversesMovementId }),
  };
}

function copyMovement(input: ProductionMovement): ProductionMovement {
  return movement(input);
}

function assertIdentity(value: string): void {
  if (value.length === 0) {
    throw new InvalidProduction();
  }
}

function assertPositive(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new InvalidProduction();
  }
}

function assertWhole(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidProduction();
  }
}

function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}
