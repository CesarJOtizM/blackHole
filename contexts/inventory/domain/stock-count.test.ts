import { expect, it } from "vitest";

import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  COUNT_SCOPE,
  InvalidCount,
  MissingCountLine,
  submitStockCount,
} from "#domain/stock-count.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const LOCATION_ID = "location_point_of_sale";
const OTHER_LOCATION_ID = "location_warehouse";
const BEEF_ID = "ingredient_beef";
const MILK_ID = "ingredient_milk";
const CHEESE_ID = "ingredient_cheese";
const ONION_ID = "ingredient_onion";
const CUT_OFF = "2026-11-13T18:00:00.000Z";
const BEFORE = "2026-11-13T17:00:00.000Z";
const AFTER = "2026-11-13T19:00:00.000Z";

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const movement = (input: {
  id: string;
  ingredientId: string;
  quantity: number;
  occurredAt: string;
  locationId?: string;
  type?: (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE];
  unitCost?: number;
}) => ({
  id: input.id,
  locationId: input.locationId ?? LOCATION_ID,
  ingredientId: input.ingredientId,
  quantity: input.quantity,
  unitCost: input.unitCost ?? 10,
  type: input.type ?? MOVEMENT_TYPE.PURCHASE,
  reference: input.id,
  occurredAt: input.occurredAt,
});

it("given movers at the location by the cut-off, when a full count is submitted, then later lines are ignored, a zero variance is skipped, and the value is the absolute sum", () => {
  const result = submitStockCount({
    locationId: LOCATION_ID,
    cutOff: CUT_OFF,
    scope: COUNT_SCOPE.FULL,
    movements: [
      movement({
        id: "movement_beef_before",
        ingredientId: BEEF_ID,
        quantity: grams(8000),
        occurredAt: BEFORE,
        unitCost: 10,
      }),
      movement({
        id: "movement_milk_before",
        ingredientId: MILK_ID,
        quantity: grams(1000),
        occurredAt: BEFORE,
        unitCost: 4,
      }),
      movement({
        id: "movement_cheese_before",
        ingredientId: CHEESE_ID,
        quantity: grams(100),
        occurredAt: BEFORE,
        unitCost: 8,
      }),
      movement({
        id: "movement_beef_sale_after",
        ingredientId: BEEF_ID,
        quantity: -grams(200),
        occurredAt: AFTER,
        type: MOVEMENT_TYPE.SALE_CONSUMPTION,
        unitCost: 10,
      }),
      movement({
        id: "movement_beef_purchase_after",
        ingredientId: BEEF_ID,
        quantity: grams(500),
        occurredAt: AFTER,
        unitCost: 99,
      }),
      movement({
        id: "movement_onion_other_location",
        ingredientId: ONION_ID,
        quantity: grams(300),
        occurredAt: BEFORE,
        locationId: OTHER_LOCATION_ID,
      }),
    ],
    averageCosts: [
      { ingredientId: BEEF_ID, averageCost: 2 },
      { ingredientId: MILK_ID, averageCost: 3 },
      { ingredientId: CHEESE_ID, averageCost: 5 },
    ],
    lines: [
      { ingredientId: BEEF_ID, quantity: grams(7400) },
      { ingredientId: MILK_ID, quantity: grams(1500) },
      { ingredientId: CHEESE_ID, quantity: grams(100) },
    ],
  });

  expect(result.locationId).toBe(LOCATION_ID);
  expect(result.lines).toEqual([
    {
      locationId: LOCATION_ID,
      ingredientId: BEEF_ID,
      quantity: -grams(600),
      averageCost: 2,
      valueCop: 1200,
    },
    {
      locationId: LOCATION_ID,
      ingredientId: MILK_ID,
      quantity: grams(500),
      averageCost: 3,
      valueCop: 1500,
    },
  ]);
  expect(result.valueCop).toBe(2700);
  expect(result.lines.some((line) => line.ingredientId === CHEESE_ID)).toBe(
    false,
  );
  expect(result.lines.some((line) => line.ingredientId === ONION_ID)).toBe(
    false,
  );
});

it("given a movement exactly at the cut-off, when the balance is frozen, then that movement counts and a later one does not", () => {
  const result = submitStockCount({
    locationId: LOCATION_ID,
    cutOff: CUT_OFF,
    scope: COUNT_SCOPE.FULL,
    movements: [
      movement({
        id: "movement_beef_at_cutoff",
        ingredientId: BEEF_ID,
        quantity: grams(8000),
        occurredAt: CUT_OFF,
      }),
      movement({
        id: "movement_beef_after",
        ingredientId: BEEF_ID,
        quantity: -grams(200),
        occurredAt: AFTER,
        type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      }),
    ],
    averageCosts: [{ ingredientId: BEEF_ID, averageCost: 2 }],
    lines: [{ ingredientId: BEEF_ID, quantity: grams(7400) }],
  });

  expect(result.lines).toEqual([
    {
      locationId: LOCATION_ID,
      ingredientId: BEEF_ID,
      quantity: -grams(600),
      averageCost: 2,
      valueCop: 1200,
    },
  ]);
});

it("given a dairy classification, when a category count is submitted, then only movers in that classification are required", () => {
  const result = submitStockCount({
    locationId: LOCATION_ID,
    cutOff: CUT_OFF,
    scope: COUNT_SCOPE.CATEGORY,
    classification: [MILK_ID, CHEESE_ID],
    movements: [
      movement({
        id: "movement_beef",
        ingredientId: BEEF_ID,
        quantity: grams(8000),
        occurredAt: BEFORE,
      }),
      movement({
        id: "movement_milk",
        ingredientId: MILK_ID,
        quantity: grams(1000),
        occurredAt: BEFORE,
      }),
      movement({
        id: "movement_cheese_after",
        ingredientId: CHEESE_ID,
        quantity: grams(100),
        occurredAt: AFTER,
      }),
    ],
    averageCosts: [{ ingredientId: MILK_ID, averageCost: 4 }],
    lines: [
      { ingredientId: MILK_ID, quantity: grams(900) },
      { ingredientId: BEEF_ID, quantity: grams(1) },
    ],
  });

  expect(result.lines).toEqual([
    {
      locationId: LOCATION_ID,
      ingredientId: MILK_ID,
      quantity: -grams(100),
      averageCost: 4,
      valueCop: 400,
    },
  ]);
  expect(result.valueCop).toBe(400);
});

it("given a full count missing one ingredient, when it is submitted, then it is rejected naming that ingredient", () => {
  const submit = () => {
    submitStockCount({
      locationId: LOCATION_ID,
      cutOff: CUT_OFF,
      scope: COUNT_SCOPE.FULL,
      movements: [
        movement({
          id: "movement_beef",
          ingredientId: BEEF_ID,
          quantity: grams(8000),
          occurredAt: BEFORE,
        }),
        movement({
          id: "movement_milk",
          ingredientId: MILK_ID,
          quantity: grams(1000),
          occurredAt: BEFORE,
        }),
      ],
      averageCosts: [
        { ingredientId: BEEF_ID, averageCost: 2 },
        { ingredientId: MILK_ID, averageCost: 4 },
      ],
      lines: [{ ingredientId: MILK_ID, quantity: grams(1000) }],
    });
  };

  expect(submit).toThrow(MissingCountLine);
  try {
    submit();
  } catch (error) {
    expect(error).toBeInstanceOf(MissingCountLine);
    expect((error as MissingCountLine).ingredientIds).toEqual([BEEF_ID]);
    expect((error as Error).message).toContain(BEEF_ID);
  }
});

it("given a category count missing a classified mover, when it is submitted, then the gap names that ingredient and not the rest", () => {
  const submit = () => {
    submitStockCount({
      locationId: LOCATION_ID,
      cutOff: CUT_OFF,
      scope: COUNT_SCOPE.CATEGORY,
      classification: [MILK_ID, CHEESE_ID, BEEF_ID],
      movements: [
        movement({
          id: "movement_beef",
          ingredientId: BEEF_ID,
          quantity: grams(8000),
          occurredAt: BEFORE,
        }),
        movement({
          id: "movement_milk",
          ingredientId: MILK_ID,
          quantity: grams(1000),
          occurredAt: BEFORE,
        }),
      ],
      averageCosts: [{ ingredientId: BEEF_ID, averageCost: 2 }],
      lines: [{ ingredientId: BEEF_ID, quantity: grams(8000) }],
    });
  };

  expect(submit).toThrow(MissingCountLine);
  try {
    submit();
  } catch (error) {
    expect((error as MissingCountLine).ingredientIds).toEqual([MILK_ID]);
  }
});

it("given a counted zero against a positive cut-off balance, when it is submitted, then the shortage is kept", () => {
  const result = submitStockCount({
    locationId: LOCATION_ID,
    cutOff: CUT_OFF,
    scope: COUNT_SCOPE.FULL,
    movements: [
      movement({
        id: "movement_beef",
        ingredientId: BEEF_ID,
        quantity: grams(600),
        occurredAt: BEFORE,
      }),
    ],
    averageCosts: [{ ingredientId: BEEF_ID, averageCost: 2 }],
    lines: [{ ingredientId: BEEF_ID, quantity: 0 }],
  });

  expect(result.lines).toEqual([
    {
      locationId: LOCATION_ID,
      ingredientId: BEEF_ID,
      quantity: -grams(600),
      averageCost: 2,
      valueCop: 1200,
    },
  ]);
  expect(result.valueCop).toBe(1200);
});

it("given a count whose variance is not a whole number of COP, when it is submitted, then it is rejected", () => {
  const submit = () => {
    submitStockCount({
      locationId: LOCATION_ID,
      cutOff: CUT_OFF,
      scope: COUNT_SCOPE.FULL,
      movements: [
        movement({
          id: "movement_beef",
          ingredientId: BEEF_ID,
          quantity: grams(1),
          occurredAt: BEFORE,
        }),
      ],
      averageCosts: [{ ingredientId: BEEF_ID, averageCost: 1 }],
      lines: [{ ingredientId: BEEF_ID, quantity: 500 }],
    });
  };

  expect(submit).toThrow(InvalidCount);
});
