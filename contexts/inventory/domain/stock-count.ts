import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { type MovementType, onHandDelta } from "#domain/stock-ledger.js";

export const COUNT_SCOPE = {
  FULL: "full",
  CATEGORY: "category",
} as const;

export type CountScope = (typeof COUNT_SCOPE)[keyof typeof COUNT_SCOPE];

const COUNT_SCOPES: ReadonlySet<string> = new Set(Object.values(COUNT_SCOPE));

export class MissingCountLine extends Error {
  readonly ingredientIds: readonly string[];

  constructor(ingredientIds: readonly string[]) {
    super(`Stock count is missing ${ingredientIds.join(", ")}.`);
    this.name = "MissingCountLine";
    this.ingredientIds = ingredientIds;
  }
}

export class InvalidCount extends Error {
  constructor() {
    super(
      "A stock count must freeze whole quantities and whole COP at the cut-off.",
    );
    this.name = "InvalidCount";
  }
}

export interface FrozenCountLine {
  locationId: string;
  ingredientId: string;
  quantity: number;
  averageCost: number;
  valueCop: number;
}

export interface StockCountResult {
  locationId: string;
  lines: readonly FrozenCountLine[];
  valueCop: number;
}

interface CountMovement {
  id: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  occurredAt: string;
  type: MovementType;
  reversesMovementId?: string;
}

interface CountedLine {
  ingredientId: string;
  quantity: number;
}

interface AverageCostSnapshot {
  ingredientId: string;
  averageCost: number;
}

interface SubmitStockCount {
  locationId: string;
  cutOff: string;
  scope: CountScope;
  classification?: readonly string[];
  movements: readonly CountMovement[];
  averageCosts: readonly AverageCostSnapshot[];
  lines: readonly CountedLine[];
}

// Freezes location, ingredient, variance quantity, and average cost at cut-off.
// The average is the supplied snapshot. Later movements are not replayed into it.
export function submitStockCount(input: SubmitStockCount): StockCountResult {
  if (!COUNT_SCOPES.has(input.scope)) {
    throw new InvalidCount();
  }

  const cutOff = instant(input.cutOff);
  const classification = classifiedIngredients(input);
  const included = input.movements.filter(
    (movement) =>
      movement.locationId === input.locationId &&
      instant(movement.occurredAt) <= cutOff,
  );
  const expected = expectedIngredients(included, input.scope, classification);
  const counted = countedQuantities(input.lines);
  const missing = expected.filter((ingredientId) => !counted.has(ingredientId));

  if (missing.length > 0) {
    throw new MissingCountLine(missing);
  }

  const averageCost = averageCosts(input.averageCosts);
  const lines: FrozenCountLine[] = [];

  for (const ingredientId of expected) {
    const quantity =
      countedQuantity(counted, ingredientId) -
      theoreticalQuantity(included, ingredientId);

    if (quantity === 0) {
      continue;
    }

    const cost = averageCost.get(ingredientId);

    if (cost === undefined) {
      throw new InvalidCount();
    }

    lines.push({
      locationId: input.locationId,
      ingredientId,
      quantity,
      averageCost: cost,
      valueCop: wholeCop(quantity, cost),
    });
  }

  return {
    locationId: input.locationId,
    lines,
    valueCop: lines.reduce((total, line) => total + line.valueCop, 0),
  };
}

function classifiedIngredients(
  input: SubmitStockCount,
): ReadonlySet<string> | undefined {
  if (input.scope !== COUNT_SCOPE.CATEGORY) {
    return undefined;
  }

  if (input.classification === undefined) {
    throw new InvalidCount();
  }

  return new Set(input.classification);
}

function expectedIngredients(
  movements: readonly CountMovement[],
  scope: CountScope,
  classification: ReadonlySet<string> | undefined,
): string[] {
  const expected: string[] = [];
  const seen = new Set<string>();

  for (const movement of movements) {
    if (seen.has(movement.ingredientId)) {
      continue;
    }

    if (
      scope === COUNT_SCOPE.CATEGORY &&
      !classification?.has(movement.ingredientId)
    ) {
      continue;
    }

    seen.add(movement.ingredientId);
    expected.push(movement.ingredientId);
  }

  return expected;
}

function countedQuantities(
  lines: readonly CountedLine[],
): ReadonlyMap<string, number> {
  const counted = new Map<string, number>();

  for (const line of lines) {
    if (counted.has(line.ingredientId)) {
      throw new InvalidCount();
    }

    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new InvalidCount();
    }

    counted.set(line.ingredientId, line.quantity);
  }

  return counted;
}

function countedQuantity(
  counted: ReadonlyMap<string, number>,
  ingredientId: string,
): number {
  const quantity = counted.get(ingredientId);

  if (quantity === undefined) {
    throw new MissingCountLine([ingredientId]);
  }

  return quantity;
}

function averageCosts(
  snapshots: readonly AverageCostSnapshot[],
): ReadonlyMap<string, number> {
  const costs = new Map<string, number>();

  for (const snapshot of snapshots) {
    if (!Number.isInteger(snapshot.averageCost) || snapshot.averageCost < 0) {
      throw new InvalidCount();
    }

    costs.set(snapshot.ingredientId, snapshot.averageCost);
  }

  return costs;
}

function theoreticalQuantity(
  movements: readonly CountMovement[],
  ingredientId: string,
): number {
  let total = 0;
  const prior: CountMovement[] = [];

  for (const movement of movements) {
    if (movement.ingredientId === ingredientId) {
      total += onHandDelta(movement, prior);
    }

    prior.push(movement);
  }

  return total;
}

function instant(value: string): number {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    throw new InvalidCount();
  }

  return parsed;
}

function wholeCop(quantity: number, averageCost: number): number {
  const value = (Math.abs(quantity) * averageCost) / QUANTITY_SCALE;

  if (!Number.isInteger(value)) {
    throw new InvalidCount();
  }

  return value;
}
