import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vitest";

import { DrizzleRecipeCopyRepository } from "#adapters/sqlite/drizzle-recipe-copy-repository.js";
import type { RecipePublication } from "#application/ports/recipe-catalog-repository.js";
import { recipeCopyRepositoryContract } from "#application/ports/recipe-copy-repository.contract.js";
import { BASE_UNIT, QUANTITY_SCALE } from "#domain/recipe-catalog.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0001_recipe_copy.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "organization_tenant_a";
const BRAND_ID = "organization_brand_shared";
const AUTHOR_ID = "user_owner";
const EDITOR_ID = "user_editor";

const clients: DatabaseSync[] = [];

afterAll(() => {
  for (const client of clients) {
    client.close();
  }
});

const openRepository = (): DrizzleRecipeCopyRepository => {
  const client = new DatabaseSync(":memory:");
  clients.push(client);
  client.exec(migration);

  return new DrizzleRecipeCopyRepository(client);
};

const publishedCopy = (
  version: number,
  authorId: string,
): RecipePublication => ({
  tenantId: TENANT_A,
  brandId: BRAND_ID,
  version,
  authorId,
  ingredients: [
    {
      id: "ingredient_onion",
      name: "onion",
      baseUnit: BASE_UNIT.GRAM,
      purchaseUnit: { name: "50 kg sack", factor: 50_000 * QUANTITY_SCALE },
      recipeUnit: { name: "g", factor: QUANTITY_SCALE },
      referenceCostCop: 80,
    },
  ],
  recipes: [
    {
      id: "recipe_burger",
      name: "burger",
      productId: "product_burger",
      variantId: "variant_double",
      lines: [
        {
          kind: "ingredient",
          ingredientId: "ingredient_onion",
          netQuantity: 150 * QUANTITY_SCALE,
          yieldPercent: 75,
        },
        {
          kind: "recipe",
          recipeId: "recipe_bechamel",
          netQuantity: 2 * QUANTITY_SCALE,
          yieldPercent: 100,
          stocked: true,
        },
      ],
    },
  ],
  modifiers: [
    {
      id: "modifier_extra_cheese",
      name: "extra cheese",
      deltas: [
        {
          ingredientId: "ingredient_cheese",
          quantity: 30 * QUANTITY_SCALE,
        },
      ],
    },
    {
      id: "modifier_plain",
      name: "plain",
      deltas: [],
    },
  ],
});

recipeCopyRepositoryContract(openRepository);

it("given a node holding version 3, when version 4 is not applied, then version 3 stays", async () => {
  const repository = openRepository();
  const held = publishedCopy(3, AUTHOR_ID);
  const missed = publishedCopy(4, EDITOR_ID);

  expect(await repository.apply(held)).toEqual(held);

  expect(missed.version).toBe(held.version + 1);
  expect(await repository.load(TENANT_A, BRAND_ID)).toEqual(held);
});
