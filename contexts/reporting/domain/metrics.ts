export interface SalesParts {
  grossCop: number;
  discountCop: number;
  includedTaxCop: number;
  tipCop: number;
}

export const durationMs = (
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): number | null => {
  if (startedAt == null || endedAt == null) {
    return null;
  }

  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);

  if (Number.isNaN(started) || Number.isNaN(ended)) {
    return null;
  }

  return ended - started;
};

export const nearestRank = (
  samples: readonly number[],
  percentile: number,
): number | null => {
  if (samples.length === 0) {
    return null;
  }

  const sorted = samples.toSorted((left, right) => left - right);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.min(sorted.length - 1, Math.max(0, index))] ?? null;
};

export const average = (samples: readonly number[]): number | null => {
  if (samples.length === 0) {
    return null;
  }

  return samples.reduce((total, value) => total + value, 0) / samples.length;
};

export const netSalesCop = (parts: SalesParts): number =>
  parts.grossCop - parts.discountCop - parts.includedTaxCop - parts.tipCop;

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

export const WEEKDAY = {
  SUNDAY: "sunday",
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
} as const;

export type Weekday = (typeof WEEKDAY)[keyof typeof WEEKDAY];

const WEEKDAYS = [
  WEEKDAY.SUNDAY,
  WEEKDAY.MONDAY,
  WEEKDAY.TUESDAY,
  WEEKDAY.WEDNESDAY,
  WEEKDAY.THURSDAY,
  WEEKDAY.FRIDAY,
  WEEKDAY.SATURDAY,
] as const;

const bogotaInstant = (instant: string): Date =>
  new Date(Date.parse(instant) - BOGOTA_OFFSET_MS);

export const bogotaHour = (instant: string): number =>
  bogotaInstant(instant).getUTCHours();

export const bogotaWeekday = (instant: string): Weekday =>
  WEEKDAYS[bogotaInstant(instant).getUTCDay()] ?? WEEKDAY.SUNDAY;

const inHalfOpenRange = (instant: string, from: string, to: string): boolean =>
  instant >= from && instant < to;

export const FOOD_COST_LINE = {
  SALE_CONSUMPTION: "sale_consumption",
  SALE_RETURN: "sale_return",
} as const;

export type FoodCostLineKind =
  (typeof FOOD_COST_LINE)[keyof typeof FOOD_COST_LINE];

export interface FoodCostSale {
  productId: string;
  occurredAt: string;
  netSalesCop: number;
}

export interface FoodCostConsumption {
  productId: string;
  occurredAt: string;
  quantity: number;
  unitCostCop: number;
  recipeVersion: number | null;
  kind: FoodCostLineKind;
}

export interface FoodCostQuery {
  from: string;
  to: string;
  sales: readonly FoodCostSale[];
  consumptions: readonly FoodCostConsumption[];
}

export interface RecipeVersionLine {
  productId: string;
  occurredAt: string;
  recipeVersion: number | null;
}

export interface FoodCostRatio {
  ratio: number | null;
  theoreticalCop: number;
  netSalesCop: number;
  uncostedProductIds: readonly string[];
  recipeVersions: readonly RecipeVersionLine[];
}

const lineCostCop = (line: FoodCostConsumption): number => {
  const cost = Math.abs(line.quantity) * line.unitCostCop;

  return line.kind === FOOD_COST_LINE.SALE_RETURN ? -cost : cost;
};

export const foodCostRatio = (query: FoodCostQuery): FoodCostRatio => {
  const sales = query.sales.filter((line) =>
    inHalfOpenRange(line.occurredAt, query.from, query.to),
  );
  const consumptions = query.consumptions.filter((line) =>
    inHalfOpenRange(line.occurredAt, query.from, query.to),
  );
  const costedProductIds = new Set(
    consumptions
      .filter((line) => line.kind === FOOD_COST_LINE.SALE_CONSUMPTION)
      .map((line) => line.productId),
  );
  const uncostedProductIds: string[] = [];
  const seenUncosted = new Set<string>();

  for (const sale of sales) {
    if (
      costedProductIds.has(sale.productId) ||
      seenUncosted.has(sale.productId)
    ) {
      continue;
    }

    seenUncosted.add(sale.productId);
    uncostedProductIds.push(sale.productId);
  }

  const theoreticalCop = consumptions
    .filter((line) => costedProductIds.has(line.productId))
    .reduce((total, line) => total + lineCostCop(line), 0);
  const netSales = sales
    .filter((line) => costedProductIds.has(line.productId))
    .reduce((total, line) => total + line.netSalesCop, 0);

  return {
    ratio: netSales === 0 ? null : theoreticalCop / netSales,
    theoreticalCop,
    netSalesCop: netSales,
    uncostedProductIds,
    recipeVersions: consumptions.map((line) => ({
      productId: line.productId,
      occurredAt: line.occurredAt,
      recipeVersion: line.recipeVersion,
    })),
  };
};

export const STOCK_MOVEMENT = {
  PURCHASE: "purchase",
  TRANSFER_IN: "transfer_in",
  PRODUCTION_OUTPUT: "production_output",
  SALE_CONSUMPTION: "sale_consumption",
  SALE_RETURN: "sale_return",
  PRODUCTION_CONSUMPTION: "production_consumption",
  WASTE: "waste",
} as const;

export type StockMovementKind =
  (typeof STOCK_MOVEMENT)[keyof typeof STOCK_MOVEMENT];

export interface StockCountFact {
  locationId: string;
  ingredientId: string;
  quantity: number;
  approvedAt: string;
  averageCostCop: number;
}

export interface StockMovementFact {
  locationId: string;
  ingredientId: string;
  kind: StockMovementKind;
  quantity: number;
  occurredAt: string;
}

export interface StockGapQuery {
  counts: readonly StockCountFact[];
  movements: readonly StockMovementFact[];
}

export interface StockGapRow {
  locationId: string;
  ingredientId: string;
  theoreticalQuantity: number;
  actualQuantity: number;
  differenceQuantity: number;
  wasteQuantity: number;
  averageCostCop: number;
  differenceCop: number;
}

export type StockGapResult =
  | { readonly status: "pending" }
  | { readonly status: "ready"; readonly rows: readonly StockGapRow[] };

const stockKey = (row: { locationId: string; ingredientId: string }): string =>
  `${row.locationId}\0${row.ingredientId}`;

const RECEIPT_KINDS: ReadonlySet<StockMovementKind> = new Set([
  STOCK_MOVEMENT.PURCHASE,
  STOCK_MOVEMENT.TRANSFER_IN,
  STOCK_MOVEMENT.PRODUCTION_OUTPUT,
]);

const usedQuantity = (kind: StockMovementKind, quantity: number): number => {
  const magnitude = Math.abs(quantity);

  return kind === STOCK_MOVEMENT.SALE_RETURN ? -magnitude : magnitude;
};

export const stockGap = (query: StockGapQuery): StockGapResult => {
  const keys = new Set<string>();

  for (const count of query.counts) {
    keys.add(stockKey(count));
  }

  for (const movement of query.movements) {
    keys.add(stockKey(movement));
  }

  if (keys.size === 0) {
    return { status: "pending" };
  }

  const rows: StockGapRow[] = [];

  for (const key of keys) {
    const counts = query.counts
      .filter((count) => stockKey(count) === key)
      .toSorted((left, right) =>
        left.approvedAt.localeCompare(right.approvedAt),
      );

    const opening = counts[0];
    const closing = counts.length >= 2 ? counts[counts.length - 1] : undefined;

    if (opening === undefined || closing === undefined) {
      return { status: "pending" };
    }

    const movements = query.movements.filter(
      (movement) =>
        stockKey(movement) === key &&
        inHalfOpenRange(
          movement.occurredAt,
          opening.approvedAt,
          closing.approvedAt,
        ),
    );
    const received = movements
      .filter((movement) => RECEIPT_KINDS.has(movement.kind))
      .reduce((total, movement) => total + movement.quantity, 0);
    const theoreticalQuantity = movements
      .filter(
        (movement) =>
          movement.kind === STOCK_MOVEMENT.SALE_CONSUMPTION ||
          movement.kind === STOCK_MOVEMENT.SALE_RETURN ||
          movement.kind === STOCK_MOVEMENT.PRODUCTION_CONSUMPTION,
      )
      .reduce(
        (total, movement) =>
          total + usedQuantity(movement.kind, movement.quantity),
        0,
      );
    const wasteQuantity = movements
      .filter((movement) => movement.kind === STOCK_MOVEMENT.WASTE)
      .reduce((total, movement) => total + Math.abs(movement.quantity), 0);
    const actualQuantity = opening.quantity + received - closing.quantity;
    const differenceQuantity = actualQuantity - theoreticalQuantity;

    rows.push({
      locationId: opening.locationId,
      ingredientId: opening.ingredientId,
      theoreticalQuantity,
      actualQuantity,
      differenceQuantity,
      wasteQuantity,
      averageCostCop: closing.averageCostCop,
      differenceCop: differenceQuantity * closing.averageCostCop,
    });
  }

  return { status: "ready", rows };
};
