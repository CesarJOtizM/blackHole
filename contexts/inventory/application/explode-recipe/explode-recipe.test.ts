import { expect, it } from "vitest";

import { InMemoryRecipeCatalogRepository } from "#adapters/memory/in-memory-recipe-catalog-repository.js";
import { ExplodeRecipe } from "#application/explode-recipe/explode-recipe.js";
import { UpdateRecipeCatalog } from "#application/update-recipe-catalog/update-recipe-catalog.js";
import { BASE_UNIT, QUANTITY_SCALE } from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const AUTHOR_ID = "user_owner";
const BUTTER_ID = "ingredient_butter";
const BECHAMEL_ID = "recipe_bechamel";
const LASAGNA_ID = "product_lasagna";
const LASAGNA_RECIPE_ID = "recipe_lasagna";

it("given lasagna uses a stocked bechamel, when the recipe is exploded, then bechamel stays one collapsed line", async () => {
  const repository = new InMemoryRecipeCatalogRepository();
  const update = new UpdateRecipeCatalog(repository);
  await update.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    authorId: AUTHOR_ID,
    commands: [
      {
        type: "upsertIngredient",
        id: BUTTER_ID,
        name: "butter",
        baseUnit: BASE_UNIT.GRAM,
        purchaseUnit: { name: "g", baseQuantity: 1 },
        recipeUnit: { name: "g", baseQuantity: 1 },
        referenceCostCop: 10,
      },
      {
        type: "upsertRecipe",
        id: BECHAMEL_ID,
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
      },
      {
        type: "upsertRecipe",
        id: LASAGNA_RECIPE_ID,
        name: "lasagna",
        productId: LASAGNA_ID,
        lines: [
          {
            kind: "recipe",
            recipeId: BECHAMEL_ID,
            netQuantity: 2,
            yieldPercent: 100,
            stocked: true,
          },
        ],
      },
    ],
  });
  const explode = new ExplodeRecipe(repository);

  const lines = await explode.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    productId: LASAGNA_ID,
  });

  expect(lines).toEqual([
    { ingredientId: BECHAMEL_ID, quantity: 2 * QUANTITY_SCALE },
  ]);
  expect(await repository.listPublications(TENANT_ID, BRAND_ID)).toHaveLength(
    1,
  );
});
