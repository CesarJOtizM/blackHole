import { expect, it } from "vitest";

import {
  average,
  durationMs,
  foodCostRatio,
  nearestRank,
  netSalesCop,
  stockGap,
} from "#domain/metrics.js";

const STARTED_AT = "2026-11-11T18:00:00.000Z";
const READY_AT = "2026-11-11T18:02:00.000Z";

it("given a line never marked ready, when preparation time is computed, then that line contributes no value", () => {
  const sample = durationMs(STARTED_AT, null);

  expect(sample).toBeNull();
});

it("given a missing start, when the span is computed, then the sample is dropped", () => {
  const sample = durationMs(null, READY_AT);

  expect(sample).toBeNull();
});

it("given both ends, when the span is computed, then the duration is the difference", () => {
  const sample = durationMs(STARTED_AT, READY_AT);

  expect(sample).toBe(120_000);
});

it("given an empty sample, when p50, p90 and the average are read, then no figure is returned", () => {
  expect(nearestRank([], 50)).toBeNull();
  expect(nearestRank([], 90)).toBeNull();
  expect(average([])).toBeNull();
});

it("given four durations, when p50 and p90 are read, then the rank is ceil(p/100*n)-1", () => {
  const samples = [40, 10, 30, 20];

  expect(nearestRank(samples, 50)).toBe(20);
  expect(nearestRank(samples, 90)).toBe(40);
});

it("given gross, discount, included tax and tip, when net sales are computed, then those three are subtracted", () => {
  const net = netSalesCop({
    grossCop: 10_000,
    discountCop: 1_000,
    includedTaxCop: 1_900,
    tipCop: 500,
  });

  expect(net).toBe(6_600);
});

const WEEK_FROM = "2026-11-09T05:00:00.000Z";
const WEEK_TO = "2026-11-16T05:00:00.000Z";
const INSIDE_WEEK = "2026-11-11T18:00:00.000Z";
const COUNT_OPEN = "2026-11-01T05:00:00.000Z";
const COUNT_CLOSE = "2026-11-08T05:00:00.000Z";
const BETWEEN_COUNTS = "2026-11-04T15:00:00.000Z";

it("given net sales of 10000000 and theoretical cost of 3200000 inside a half-open week, when food cost is computed, then the ratio is 32 percent", () => {
  const result = foodCostRatio({
    from: WEEK_FROM,
    to: WEEK_TO,
    sales: [
      {
        productId: "burger",
        occurredAt: INSIDE_WEEK,
        netSalesCop: 10_000_000,
      },
      {
        productId: "burger",
        occurredAt: WEEK_TO,
        netSalesCop: 9_000_000,
      },
    ],
    consumptions: [
      {
        productId: "burger",
        occurredAt: INSIDE_WEEK,
        quantity: 350,
        unitCostCop: 10_000,
        recipeVersion: 2,
        kind: "sale_consumption",
      },
      {
        productId: "burger",
        occurredAt: INSIDE_WEEK,
        quantity: 30,
        unitCostCop: 10_000,
        recipeVersion: 2,
        kind: "sale_return",
      },
      {
        productId: "burger",
        occurredAt: WEEK_TO,
        quantity: 1,
        unitCostCop: 9_000_000,
        recipeVersion: 9,
        kind: "sale_consumption",
      },
    ],
  });

  expect(result.theoreticalCop).toBe(3_200_000);
  expect(result.netSalesCop).toBe(10_000_000);
  expect(result.ratio).toBe(3_200_000 / 10_000_000);
});

it("given a sold product with no recipe, when food cost is computed, then the product is listed as uncosted and excluded from both sides", () => {
  const result = foodCostRatio({
    from: WEEK_FROM,
    to: WEEK_TO,
    sales: [
      {
        productId: "burger",
        occurredAt: INSIDE_WEEK,
        netSalesCop: 8_000_000,
      },
      { productId: "soda", occurredAt: INSIDE_WEEK, netSalesCop: 2_000_000 },
    ],
    consumptions: [
      {
        productId: "burger",
        occurredAt: INSIDE_WEEK,
        quantity: 100,
        unitCostCop: 24_000,
        recipeVersion: 1,
        kind: "sale_consumption",
      },
    ],
  });

  expect(result.uncostedProductIds).toEqual(["soda"]);
  expect(result.theoreticalCop).toBe(2_400_000);
  expect(result.netSalesCop).toBe(8_000_000);
  expect(result.ratio).toBe(2_400_000 / 8_000_000);
});

it("given costed sales whose net is zero, when food cost is computed, then no ratio is returned", () => {
  const result = foodCostRatio({
    from: WEEK_FROM,
    to: WEEK_TO,
    sales: [{ productId: "burger", occurredAt: INSIDE_WEEK, netSalesCop: 0 }],
    consumptions: [
      {
        productId: "burger",
        occurredAt: INSIDE_WEEK,
        quantity: 10,
        unitCostCop: 100,
        recipeVersion: 2,
        kind: "sale_consumption",
      },
    ],
  });

  expect(result.netSalesCop).toBe(0);
  expect(result.theoreticalCop).toBe(1_000);
  expect(result.ratio).toBeNull();
});

it("given a recipe that changes mid-period, when food cost is computed, then each consumption keeps its recipe version", () => {
  const monday = "2026-11-09T18:00:00.000Z";
  const wednesday = "2026-11-11T18:00:00.000Z";

  const result = foodCostRatio({
    from: WEEK_FROM,
    to: WEEK_TO,
    sales: [
      { productId: "burger", occurredAt: monday, netSalesCop: 4_000_000 },
      { productId: "burger", occurredAt: wednesday, netSalesCop: 6_000_000 },
    ],
    consumptions: [
      {
        productId: "burger",
        occurredAt: monday,
        quantity: 100,
        unitCostCop: 10_000,
        recipeVersion: 1,
        kind: "sale_consumption",
      },
      {
        productId: "burger",
        occurredAt: wednesday,
        quantity: 110,
        unitCostCop: 20_000,
        recipeVersion: 4,
        kind: "sale_consumption",
      },
    ],
  });

  expect(result.recipeVersions).toEqual([
    { productId: "burger", occurredAt: monday, recipeVersion: 1 },
    { productId: "burger", occurredAt: wednesday, recipeVersion: 4 },
  ]);
});

it("given counts and movements between them, when the stock gap is computed, then actual subtracts closing from opening plus receipts and theoretical nets sale and production consumption", () => {
  const result = stockGap({
    counts: [
      {
        locationId: "cooler",
        ingredientId: "beef",
        quantity: 100,
        approvedAt: COUNT_OPEN,
        averageCostCop: 500,
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        quantity: 90,
        approvedAt: COUNT_CLOSE,
        averageCostCop: 1_000,
      },
    ],
    movements: [
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "purchase",
        quantity: 500,
        occurredAt: "2026-10-31T05:00:00.000Z",
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "purchase",
        quantity: 20,
        occurredAt: BETWEEN_COUNTS,
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "transfer_in",
        quantity: 10,
        occurredAt: BETWEEN_COUNTS,
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "production_output",
        quantity: 3,
        occurredAt: BETWEEN_COUNTS,
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "sale_consumption",
        quantity: 35,
        occurredAt: BETWEEN_COUNTS,
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "sale_return",
        quantity: 5,
        occurredAt: BETWEEN_COUNTS,
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "production_consumption",
        quantity: 10,
        occurredAt: BETWEEN_COUNTS,
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "waste",
        quantity: 2,
        occurredAt: BETWEEN_COUNTS,
      },
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "purchase",
        quantity: 1_000,
        occurredAt: COUNT_CLOSE,
      },
    ],
  });

  expect(result).toEqual({
    status: "ready",
    rows: [
      {
        locationId: "cooler",
        ingredientId: "beef",
        theoreticalQuantity: 40,
        actualQuantity: 43,
        differenceQuantity: 3,
        wasteQuantity: 2,
        averageCostCop: 1_000,
        differenceCop: 3_000,
      },
    ],
  });
});

it("given only an opening count, when the stock gap is computed, then the period is pending and not a zero difference", () => {
  const result = stockGap({
    counts: [
      {
        locationId: "cooler",
        ingredientId: "beef",
        quantity: 100,
        approvedAt: COUNT_OPEN,
        averageCostCop: 1_000,
      },
    ],
    movements: [
      {
        locationId: "cooler",
        ingredientId: "beef",
        kind: "purchase",
        quantity: 20,
        occurredAt: BETWEEN_COUNTS,
      },
    ],
  });

  expect(result).toEqual({ status: "pending" });
});
