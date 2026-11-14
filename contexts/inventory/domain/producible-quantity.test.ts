import { expect, it } from "vitest";

import { possibleUnits } from "#domain/producible-quantity.js";
import {
  BASE_UNIT,
  QUANTITY_SCALE,
  RecipeCatalog,
} from "#domain/recipe-catalog.js";

const BEEF_ID = "ingredient_beef";
const BUN_ID = "ingredient_bun";
const SALT_ID = "ingredient_salt";
const WATER_ID = "ingredient_water";
const BUTTER_ID = "ingredient_butter";
const SAUCE_RECIPE_ID = "recipe_sauce";
const BURGER_RECIPE_ID = "recipe_burger";
const BURGER_PRODUCT_ID = "product_burger";
const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const CATALOG_ID = "recipe_catalog_organization_brand_1";
const AUTHOR_ID = "user_owner";

const BEEF_PER_UNIT = 150;
const BUN_PER_UNIT = 1;

const burgerLines = [
  { ingredientId: BEEF_ID, quantity: BEEF_PER_UNIT },
  { ingredientId: BUN_ID, quantity: BUN_PER_UNIT },
] as const;

const compute = (
  lines: readonly { ingredientId: string; quantity: number }[],
  pointBalances: ReadonlyMap<string, number>,
  supplyingBalances: ReadonlyMap<string, number> = new Map(),
  lowUnitsThreshold: number | null = null,
) =>
  possibleUnits({
    lines,
    pointBalances,
    supplyingBalances,
    lowUnitsThreshold,
  });

it("given 3000 g of beef and 12 buns, when producible units are computed, then the buns limit the result at 12", () => {
  const pointBalances = new Map<string, number>([
    [BEEF_ID, 3_000],
    [BUN_ID, 12],
  ]);

  const result = compute(burgerLines, pointBalances);

  expect(result).toEqual({
    pointUnits: 12,
    replenishmentUnits: 12,
    limitingIngredientIds: [BUN_ID],
    state: "available",
  });
});

it("given beef stock of -200 g, when producible units are computed, then the result is 0", () => {
  const pointBalances = new Map<string, number>([
    [BEEF_ID, -200],
    [BUN_ID, 12],
  ]);

  const result = compute(burgerLines, pointBalances);

  expect(result.pointUnits).toBe(0);
  expect(result.replenishmentUnits).toBe(0);
  expect(result.limitingIngredientIds).toEqual([BEEF_ID]);
  expect(result.state).toBe("sold_out");
});

it("given the point has no balance row for buns, when the limiting ingredient is requested, then buns limit the result at 0", () => {
  const pointBalances = new Map<string, number>([[BEEF_ID, 3_000]]);

  const result = compute(burgerLines, pointBalances);

  expect(result.pointUnits).toBe(0);
  expect(result.limitingIngredientIds).toEqual([BUN_ID]);
  expect(result.state).toBe("sold_out");
});

it("given beef and buns both allow 12 units, when the limiting ingredient is requested, then both ingredient ids are listed", () => {
  const pointBalances = new Map<string, number>([
    [BEEF_ID, 1_800],
    [BUN_ID, 12],
  ]);

  const result = compute(burgerLines, pointBalances);

  expect(result.pointUnits).toBe(12);
  expect(result.limitingIngredientIds).toEqual([BEEF_ID, BUN_ID]);
});

it("given a line whose quantity is at or below 0, when producible units are computed, then that line is skipped", () => {
  const pointBalances = new Map<string, number>([
    [BEEF_ID, 3_000],
    [BUN_ID, 12],
    [SALT_ID, 0],
    [WATER_ID, 0],
  ]);

  const result = compute(
    [
      ...burgerLines,
      { ingredientId: SALT_ID, quantity: 0 },
      { ingredientId: WATER_ID, quantity: -1 },
    ],
    pointBalances,
  );

  expect(result.pointUnits).toBe(12);
  expect(result.limitingIngredientIds).toEqual([BUN_ID]);
});

it("given the point allows 12 and the warehouse adds 40 buns, when units with restocking are computed, then replenishment is 52 and the point state stays", () => {
  const pointBalances = new Map<string, number>([
    [BEEF_ID, 3_000],
    [BUN_ID, 12],
  ]);
  const supplyingBalances = new Map<string, number>([
    [BEEF_ID, 6_000],
    [BUN_ID, 40],
  ]);

  const result = compute(burgerLines, pointBalances, supplyingBalances, 12);

  expect(result.pointUnits).toBe(12);
  expect(result.replenishmentUnits).toBe(52);
  expect(result.limitingIngredientIds).toEqual([BUN_ID]);
  expect(result.state).toBe("low_units");
});

it("given point units are 0 and a threshold is set, when the state is derived, then it is sold_out", () => {
  const pointBalances = new Map<string, number>([[BUN_ID, 0]]);

  const result = compute(
    [{ ingredientId: BUN_ID, quantity: 1 }],
    pointBalances,
    new Map(),
    5,
  );

  expect(result.pointUnits).toBe(0);
  expect(result.state).toBe("sold_out");
});

it("given a threshold of 5, when point units are at or under it, then the state is low_units", () => {
  const atThreshold = compute(
    [{ ingredientId: BUN_ID, quantity: 1 }],
    new Map([[BUN_ID, 5]]),
    new Map(),
    5,
  );
  const underThreshold = compute(
    [{ ingredientId: BUN_ID, quantity: 1 }],
    new Map([[BUN_ID, 4]]),
    new Map(),
    5,
  );
  const aboveThreshold = compute(
    [{ ingredientId: BUN_ID, quantity: 1 }],
    new Map([[BUN_ID, 6]]),
    new Map(),
    5,
  );

  expect(atThreshold.state).toBe("low_units");
  expect(atThreshold.pointUnits).toBe(5);
  expect(underThreshold.state).toBe("low_units");
  expect(underThreshold.pointUnits).toBe(4);
  expect(aboveThreshold.state).toBe("available");
  expect(aboveThreshold.pointUnits).toBe(6);
});

it("given no threshold, when point units are above 0, then the state stays available", () => {
  const result = compute(
    [{ ingredientId: BUN_ID, quantity: 1 }],
    new Map([[BUN_ID, 1]]),
    new Map(),
    null,
  );

  expect(result.pointUnits).toBe(1);
  expect(result.state).toBe("available");
});

it("given a stocked preparation, when stock is read for the recipe id explode returns, then that id limits producible units", () => {
  const catalog = RecipeCatalog.open({
    id: CATALOG_ID,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });
  catalog.upsertIngredient({
    id: BUTTER_ID,
    name: "butter",
    baseUnit: BASE_UNIT.GRAM,
    purchaseUnit: { name: "g", baseQuantity: 1 },
    recipeUnit: { name: "g", baseQuantity: 1 },
    referenceCostCop: 0,
  });
  catalog.upsertIngredient({
    id: BUN_ID,
    name: "bun",
    baseUnit: BASE_UNIT.UNIT,
    purchaseUnit: { name: "unit", baseQuantity: 1 },
    recipeUnit: { name: "unit", baseQuantity: 1 },
    referenceCostCop: 0,
  });
  catalog.upsertRecipe({
    id: SAUCE_RECIPE_ID,
    name: "sauce",
    productId: "product_sauce",
    lines: [
      {
        kind: "ingredient",
        ingredientId: BUTTER_ID,
        netQuantity: 40,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertRecipe({
    id: BURGER_RECIPE_ID,
    name: "burger",
    productId: BURGER_PRODUCT_ID,
    lines: [
      {
        kind: "recipe",
        recipeId: SAUCE_RECIPE_ID,
        netQuantity: 1,
        yieldPercent: 100,
        stocked: true,
      },
      {
        kind: "ingredient",
        ingredientId: BUN_ID,
        netQuantity: 1,
        yieldPercent: 100,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });

  const lines = catalog.explode({ productId: BURGER_PRODUCT_ID });
  const sauce = lines.find((line) => line.ingredientId === SAUCE_RECIPE_ID);
  const bun = lines.find((line) => line.ingredientId === BUN_ID);

  if (!sauce || !bun) {
    throw new Error("explode did not return the stocked recipe id");
  }

  const pointBalances = new Map<string, number>([
    [sauce.ingredientId, 3 * sauce.quantity],
    [bun.ingredientId, 12 * bun.quantity],
    [BUTTER_ID, 10_000 * QUANTITY_SCALE],
  ]);

  const result = compute(lines, pointBalances);

  expect(lines.map((line) => line.ingredientId)).toEqual([
    BUN_ID,
    SAUCE_RECIPE_ID,
  ]);
  expect(result).toEqual({
    pointUnits: 3,
    replenishmentUnits: 3,
    limitingIngredientIds: [SAUCE_RECIPE_ID],
    state: "available",
  });
});
