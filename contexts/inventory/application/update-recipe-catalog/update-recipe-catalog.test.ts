import { expect, it } from "vitest";

import { InMemoryRecipeCatalogRepository } from "#adapters/memory/in-memory-recipe-catalog-repository.js";
import { UpdateRecipeCatalog } from "#application/update-recipe-catalog/update-recipe-catalog.js";
import { BASE_UNIT, QUANTITY_SCALE } from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const AUTHOR_ID = "user_owner";
const EDITOR_ID = "user_editor";
const ONION_ID = "ingredient_onion";
const BURGER_ID = "product_burger";
const BURGER_RECIPE_ID = "recipe_burger";

it("given version 1 is current, when an owner publishes a change, then version 2 is current and one new publication row is stored", async () => {
  const repository = new InMemoryRecipeCatalogRepository();
  const update = new UpdateRecipeCatalog(repository);
  await update.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    authorId: AUTHOR_ID,
    commands: [
      {
        type: "upsertIngredient",
        id: ONION_ID,
        name: "onion",
        baseUnit: BASE_UNIT.GRAM,
        purchaseUnit: { name: "g", baseQuantity: 1 },
        recipeUnit: { name: "g", baseQuantity: 1 },
        referenceCostCop: 80,
      },
      {
        type: "upsertRecipe",
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
      },
    ],
  });

  const catalog = await update.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    authorId: EDITOR_ID,
    commands: [
      {
        type: "upsertRecipe",
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
      },
    ],
  });

  const publications = await repository.listPublications(TENANT_ID, BRAND_ID);
  expect(catalog.currentVersion).toBe(2);
  expect(publications).toHaveLength(2);
  expect(publications[1]).toMatchObject({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    version: 2,
    authorId: EDITOR_ID,
  });
  expect(publications.filter((row) => row.version === 2)).toHaveLength(1);
  expect(publications[1]?.recipes).toEqual([
    {
      id: BURGER_RECIPE_ID,
      name: "burger",
      productId: BURGER_ID,
      lines: [
        {
          kind: "ingredient",
          ingredientId: ONION_ID,
          netQuantity: 10 * QUANTITY_SCALE,
          yieldPercent: 100,
        },
      ],
    },
  ]);
  expect(catalog.publishedVersion(1).authorId).toBe(AUTHOR_ID);
  expect(catalog.publishedVersion(1).recipes[0]?.lines).toEqual([
    {
      kind: "ingredient",
      ingredientId: ONION_ID,
      netQuantity: 150 * QUANTITY_SCALE,
      yieldPercent: 75,
    },
  ]);
});
