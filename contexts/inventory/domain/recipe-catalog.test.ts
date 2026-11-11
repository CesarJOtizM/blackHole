import { expect, it } from "vitest";

import {
  BASE_UNIT,
  QUANTITY_SCALE,
  RecipeCatalog,
  RecipeCycle,
  ZeroUnitFactor,
} from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const CATALOG_ID = "recipe_catalog_organization_brand_1";
const AUTHOR_ID = "user_owner";
const EDITOR_ID = "user_editor";

const RICE_ID = "ingredient_rice";
const ONION_ID = "ingredient_onion";
const CHEESE_ID = "ingredient_cheese";
const BEEF_ID = "ingredient_beef";
const BUTTER_ID = "ingredient_butter";

const BURGER_ID = "product_burger";
const DOUBLE_ID = "variant_double";
const LASAGNA_ID = "product_lasagna";
const SAUCE_A_PRODUCT_ID = "product_sauce_a";
const SAUCE_B_PRODUCT_ID = "product_sauce_b";

const BURGER_RECIPE_ID = "recipe_burger";
const DOUBLE_RECIPE_ID = "recipe_double";
const BECHAMEL_RECIPE_ID = "recipe_bechamel";
const LASAGNA_RECIPE_ID = "recipe_lasagna";
const SAUCE_A_ID = "recipe_sauce_a";
const SAUCE_B_ID = "recipe_sauce_b";

const EXTRA_CHEESE_ID = "modifier_extra_cheese";
const NO_ONION_ID = "modifier_no_onion";
const TOO_MUCH_OFF_ID = "modifier_too_much_off";

const openCatalog = () =>
  RecipeCatalog.open({
    id: CATALOG_ID,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });

const gramIngredient = (id: string, name: string) => ({
  id,
  name,
  baseUnit: BASE_UNIT.GRAM,
  purchaseUnit: { name: "g", baseQuantity: 1 },
  recipeUnit: { name: "g", baseQuantity: 1 },
  referenceCostCop: 0,
});

it("given an ingredient being edited, when a unit factor is set to 0, then the change is rejected naming the unit", () => {
  const catalog = openCatalog();

  let caught: unknown;
  const edit = () => {
    catalog.upsertIngredient({
      id: RICE_ID,
      name: "rice",
      baseUnit: BASE_UNIT.GRAM,
      purchaseUnit: { name: "50 kg sack", baseQuantity: 0 },
      recipeUnit: { name: "g", baseQuantity: 1 },
      referenceCostCop: 180_000,
    });
  };

  try {
    edit();
  } catch (error) {
    caught = error;
  }

  expect(edit).toThrow(ZeroUnitFactor);
  expect(caught).toBeInstanceOf(ZeroUnitFactor);
  expect((caught as ZeroUnitFactor).unitName).toBe("50 kg sack");
  expect(catalog.ingredients).toEqual([]);
});

it("given rice with a 50 kg sack of 50000 g, when 2 sacks are converted, then the result is 100000 g", () => {
  const catalog = openCatalog();

  catalog.upsertIngredient({
    id: RICE_ID,
    name: "rice",
    baseUnit: BASE_UNIT.GRAM,
    purchaseUnit: { name: "50 kg sack", baseQuantity: 50_000 },
    recipeUnit: { name: "g", baseQuantity: 1 },
    referenceCostCop: 180_000,
  });

  expect(catalog.id).toBe(CATALOG_ID);
  expect(catalog.brandId).toBe(BRAND_ID);
  expect(catalog.ingredients).toEqual([
    {
      id: RICE_ID,
      name: "rice",
      baseUnit: BASE_UNIT.GRAM,
      purchaseUnit: {
        name: "50 kg sack",
        factor: 50_000 * QUANTITY_SCALE,
      },
      recipeUnit: { name: "g", factor: QUANTITY_SCALE },
      referenceCostCop: 180_000,
    },
  ]);
  expect(catalog.convertPurchase({ ingredientId: RICE_ID, quantity: 2 })).toBe(
    100_000 * QUANTITY_SCALE,
  );
});

it("given 150 g net onion at 75 percent yield, when exploded for one unit, then 200 g gross onion is required", () => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(ONION_ID, "onion"));
  catalog.upsertRecipe({
    id: BURGER_RECIPE_ID,
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: ONION_ID,
        netQuantity: 150,
        yieldPercent: 75,
      },
    ],
  });

  catalog.publish({ authorId: AUTHOR_ID });

  expect(catalog.explode({ productId: BURGER_ID })).toEqual([
    { ingredientId: ONION_ID, quantity: 200 * QUANTITY_SCALE },
  ]);
});

it("given burger and variant double each with a recipe, when double is resolved, then the variant recipe is used", () => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(BEEF_ID, "beef"));
  catalog.upsertRecipe({
    id: BURGER_RECIPE_ID,
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: BEEF_ID,
        netQuantity: 100,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertRecipe({
    id: DOUBLE_RECIPE_ID,
    name: "double",
    productId: BURGER_ID,
    variantId: DOUBLE_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: BEEF_ID,
        netQuantity: 200,
        yieldPercent: 100,
      },
    ],
  });

  catalog.publish({ authorId: AUTHOR_ID });

  expect(
    catalog.explode({ productId: BURGER_ID, variantId: DOUBLE_ID }),
  ).toEqual([{ ingredientId: BEEF_ID, quantity: 200 * QUANTITY_SCALE }]);
});

it("given lasagna uses non-stocked bechamel, when exploded, then bechamel ingredients appear scaled by the lasagna line", () => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(BUTTER_ID, "butter"));
  catalog.upsertRecipe({
    id: BECHAMEL_RECIPE_ID,
    name: "bechamel",
    productId: "product_bechamel",
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
    id: LASAGNA_RECIPE_ID,
    name: "lasagna",
    productId: LASAGNA_ID,
    lines: [
      {
        kind: "recipe",
        recipeId: BECHAMEL_RECIPE_ID,
        netQuantity: 2,
        yieldPercent: 100,
        stocked: false,
      },
    ],
  });

  catalog.publish({ authorId: AUTHOR_ID });

  expect(catalog.explode({ productId: LASAGNA_ID })).toEqual([
    { ingredientId: BUTTER_ID, quantity: 80 * QUANTITY_SCALE },
  ]);
});

it("given sauce A uses sauce B, when sauce B is edited to use sauce A, then the publish is rejected naming the cycle", () => {
  const catalog = openCatalog();
  catalog.upsertRecipe({
    id: SAUCE_A_ID,
    name: "sauce A",
    productId: SAUCE_A_PRODUCT_ID,
    lines: [
      {
        kind: "recipe",
        recipeId: SAUCE_B_ID,
        netQuantity: 1,
        yieldPercent: 100,
        stocked: false,
      },
    ],
  });
  catalog.upsertRecipe({
    id: SAUCE_B_ID,
    name: "sauce B",
    productId: SAUCE_B_PRODUCT_ID,
    lines: [],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  const published = catalog.publishedVersion(1);

  catalog.upsertRecipe({
    id: SAUCE_B_ID,
    name: "sauce B",
    productId: SAUCE_B_PRODUCT_ID,
    lines: [
      {
        kind: "recipe",
        recipeId: SAUCE_A_ID,
        netQuantity: 1,
        yieldPercent: 100,
        stocked: false,
      },
    ],
  });

  let caught: unknown;
  const publish = () => {
    catalog.publish({ authorId: EDITOR_ID });
  };

  try {
    publish();
  } catch (error) {
    caught = error;
  }

  expect(publish).toThrow(RecipeCycle);
  expect(caught).toBeInstanceOf(RecipeCycle);
  const cycle = (caught as RecipeCycle).cycle;
  expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  expect(cycle).toContain("sauce A");
  expect(cycle).toContain("sauce B");
  expect((caught as RecipeCycle).message).toContain("sauce A");
  expect((caught as RecipeCycle).message).toContain("sauce B");
  expect(catalog.currentVersion).toBe(1);
  expect(catalog.publishedVersion(1)).toEqual(published);
});

it("given burger uses 30 g cheese and 20 g onion, when exploded with extra cheese and no onion, then cheese is 60 g and onion is 0 g", () => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(CHEESE_ID, "cheese"));
  catalog.upsertIngredient(gramIngredient(ONION_ID, "onion"));
  catalog.upsertRecipe({
    id: BURGER_RECIPE_ID,
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: CHEESE_ID,
        netQuantity: 30,
        yieldPercent: 100,
      },
      {
        kind: "ingredient",
        ingredientId: ONION_ID,
        netQuantity: 20,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertModifier({
    id: EXTRA_CHEESE_ID,
    name: "extra cheese",
    deltas: [{ ingredientId: CHEESE_ID, quantity: 30 }],
  });
  catalog.upsertModifier({
    id: NO_ONION_ID,
    name: "no onion",
    deltas: [{ ingredientId: ONION_ID, quantity: -20 }],
  });

  catalog.publish({ authorId: AUTHOR_ID });

  expect(
    catalog.explode({
      productId: BURGER_ID,
      modifierIds: [EXTRA_CHEESE_ID, NO_ONION_ID],
    }),
  ).toEqual([
    { ingredientId: CHEESE_ID, quantity: 60 * QUANTITY_SCALE },
    { ingredientId: ONION_ID, quantity: 0 },
  ]);
});

it("given a delta of -50 g on a 20 g line, when exploded, then the quantity is 0 g", () => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(ONION_ID, "onion"));
  catalog.upsertRecipe({
    id: BURGER_RECIPE_ID,
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: ONION_ID,
        netQuantity: 20,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertModifier({
    id: TOO_MUCH_OFF_ID,
    name: "too much off",
    deltas: [{ ingredientId: ONION_ID, quantity: -50 }],
  });

  catalog.publish({ authorId: AUTHOR_ID });

  expect(
    catalog.explode({
      productId: BURGER_ID,
      modifierIds: [TOO_MUCH_OFF_ID],
    }),
  ).toEqual([{ ingredientId: ONION_ID, quantity: 0 }]);
});

it("given version 3 is current, when an owner publishes a change, then version 4 is current and version 3 stays unchanged", () => {
  const catalog = openCatalog();
  catalog.upsertIngredient(gramIngredient(ONION_ID, "onion"));
  catalog.upsertRecipe({
    id: BURGER_RECIPE_ID,
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: ONION_ID,
        netQuantity: 150,
        yieldPercent: 75,
      },
    ],
  });
  catalog.publish({ authorId: AUTHOR_ID });
  catalog.publish({ authorId: AUTHOR_ID });
  catalog.publish({ authorId: AUTHOR_ID });
  const version3 = catalog.publishedVersion(3);
  const exploded3 = catalog.explode({ productId: BURGER_ID, version: 3 });

  catalog.upsertRecipe({
    id: BURGER_RECIPE_ID,
    name: "burger",
    productId: BURGER_ID,
    lines: [
      {
        kind: "ingredient",
        ingredientId: ONION_ID,
        netQuantity: 10,
        yieldPercent: 100,
      },
    ],
  });
  const published = catalog.publish({ authorId: EDITOR_ID });

  expect(published).toBe(4);
  expect(catalog.currentVersion).toBe(4);
  expect(catalog.publishedVersion(3)).toEqual(version3);
  expect(catalog.publishedVersion(3).authorId).toBe(AUTHOR_ID);
  expect(catalog.explode({ productId: BURGER_ID, version: 3 })).toEqual(
    exploded3,
  );
  expect(exploded3).toEqual([
    { ingredientId: ONION_ID, quantity: 200 * QUANTITY_SCALE },
  ]);
  expect(catalog.explode({ productId: BURGER_ID, version: 4 })).toEqual([
    { ingredientId: ONION_ID, quantity: 10 * QUANTITY_SCALE },
  ]);
  expect(catalog.publishedVersion(4).authorId).toBe(EDITOR_ID);
});
