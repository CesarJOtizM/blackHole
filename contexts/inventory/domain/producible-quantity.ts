export type AvailabilityState = "available" | "low_units" | "sold_out";

export interface PossibleUnits {
  pointUnits: number;
  replenishmentUnits: number;
  limitingIngredientIds: readonly string[];
  state: AvailabilityState;
}

export interface PossibleUnitsInput {
  lines: readonly { ingredientId: string; quantity: number }[];
  pointBalances: ReadonlyMap<string, number>;
  supplyingBalances: ReadonlyMap<string, number>;
  lowUnitsThreshold: number | null;
}

function balanceOf(
  balances: ReadonlyMap<string, number>,
  ingredientId: string,
): number {
  return balances.get(ingredientId) ?? 0;
}

function wholeUnits(balance: number, quantity: number): number {
  return Math.floor(Math.max(balance, 0) / quantity);
}

function availabilityState(
  pointUnits: number,
  lowUnitsThreshold: number | null,
): AvailabilityState {
  if (pointUnits <= 0) {
    return "sold_out";
  }

  if (lowUnitsThreshold !== null && pointUnits <= lowUnitsThreshold) {
    return "low_units";
  }

  return "available";
}

export function possibleUnits(input: PossibleUnitsInput): PossibleUnits {
  let pointUnits = 0;
  let replenishmentUnits = 0;
  let hasLine = false;
  let limitingIngredientIds: string[] = [];

  for (const line of input.lines) {
    if (line.quantity <= 0) {
      continue;
    }

    const point = wholeUnits(
      balanceOf(input.pointBalances, line.ingredientId),
      line.quantity,
    );
    const replenishment = wholeUnits(
      balanceOf(input.pointBalances, line.ingredientId) +
        balanceOf(input.supplyingBalances, line.ingredientId),
      line.quantity,
    );

    if (!hasLine || point < pointUnits) {
      pointUnits = point;
      limitingIngredientIds = [line.ingredientId];
    } else if (point === pointUnits) {
      limitingIngredientIds = [...limitingIngredientIds, line.ingredientId];
    }

    if (!hasLine || replenishment < replenishmentUnits) {
      replenishmentUnits = replenishment;
    }

    hasLine = true;
  }

  return {
    pointUnits,
    replenishmentUnits,
    limitingIngredientIds: limitingIngredientIds.toSorted((left, right) =>
      left.localeCompare(right),
    ),
    state: availabilityState(pointUnits, input.lowUnitsThreshold),
  };
}
