import { expect, it, vi } from "vitest";

import { InMemoryRecipeCatalogRepository } from "#adapters/memory/in-memory-recipe-catalog-repository.js";
import {
  ImportRecipes,
  RecipeImportRejected,
} from "#application/import-recipes/import-recipes.js";
import type { RecipeWorkbookSheet } from "#application/ports/recipe-workbook.js";
import { RecipeWorkbook } from "#application/ports/recipe-workbook.js";
import { UpdateRecipeCatalog } from "#application/update-recipe-catalog/update-recipe-catalog.js";
import { BASE_UNIT, QUANTITY_SCALE } from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const AUTHOR_ID = "user_owner";
const RICE_ID = "ingredient_rice";
const ONION_ID = "ingredient_onion";
const BURGER_ID = "product_burger";
const BURGER_RECIPE_ID = "recipe_burger";

class SheetWorkbook extends RecipeWorkbook {
  constructor(private readonly sheet: RecipeWorkbookSheet) {
    super();
  }

  override async read(_contents: Uint8Array): Promise<RecipeWorkbookSheet> {
    return this.sheet;
  }
}

const riceSheet = (): RecipeWorkbookSheet => ({
  ingredients: [
    {
      row: 2,
      id: RICE_ID,
      name: "rice",
      baseUnit: BASE_UNIT.GRAM,
      purchaseUnit: { name: "g", baseQuantity: 1 },
      recipeUnit: { name: "g", baseQuantity: 1 },
      referenceCostCop: 12,
    },
  ],
  lines: [
    {
      row: 3,
      recipeId: BURGER_RECIPE_ID,
      recipeName: "burger",
      productId: BURGER_ID,
      kind: "ingredient",
      ingredientId: RICE_ID,
      netQuantity: 100,
      yieldPercent: 100,
    },
  ],
});

it("given row 17 has an unknown ingredient, when the workbook is imported, then row 17 is reported and nothing is saved", async () => {
  const repository = new InMemoryRecipeCatalogRepository();
  const update = new UpdateRecipeCatalog(repository);
  await update.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    authorId: AUTHOR_ID,
    commands: [
      {
        type: "upsertIngredient",
        id: RICE_ID,
        name: "rice",
        baseUnit: BASE_UNIT.GRAM,
        purchaseUnit: { name: "g", baseQuantity: 1 },
        recipeUnit: { name: "g", baseQuantity: 1 },
        referenceCostCop: 12,
      },
      {
        type: "upsertRecipe",
        id: BURGER_RECIPE_ID,
        name: "burger",
        productId: BURGER_ID,
        lines: [
          {
            kind: "ingredient",
            ingredientId: RICE_ID,
            netQuantity: 80,
            yieldPercent: 100,
          },
        ],
      },
    ],
  });
  const before = await repository.load(TENANT_ID, BRAND_ID);
  const version = before?.currentVersion;
  const ingredientIds = before?.ingredients.map((item) => item.id);
  const save = vi.spyOn(repository, "save");
  const importRecipes = new ImportRecipes(
    repository,
    new SheetWorkbook({
      ingredients: [
        {
          row: 2,
          id: ONION_ID,
          name: "onion",
          baseUnit: BASE_UNIT.GRAM,
          purchaseUnit: { name: "g", baseQuantity: 1 },
          recipeUnit: { name: "g", baseQuantity: 1 },
          referenceCostCop: 80,
        },
      ],
      lines: [
        {
          row: 17,
          recipeId: BURGER_RECIPE_ID,
          recipeName: "burger",
          productId: BURGER_ID,
          kind: "ingredient",
          ingredientId: "ingredient_missing",
          netQuantity: 10,
          yieldPercent: 100,
        },
      ],
    }),
  );

  const pending = importRecipes.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    authorId: AUTHOR_ID,
    contents: new Uint8Array(),
  });

  await expect(pending).rejects.toBeInstanceOf(RecipeImportRejected);
  await expect(pending).rejects.toMatchObject({
    rows: [{ row: 17, reason: "Unknown ingredient." }],
  });
  expect(save).not.toHaveBeenCalled();
  const after = await repository.load(TENANT_ID, BRAND_ID);
  expect(after?.currentVersion).toBe(version);
  expect(after?.ingredients.map((item) => item.id)).toEqual(ingredientIds);
  expect(after?.ingredients.map((item) => item.id)).not.toContain(ONION_ID);
  expect(await repository.listPublications(TENANT_ID, BRAND_ID)).toHaveLength(
    1,
  );
});

it("given a valid workbook, when it is imported, then the dish is published with version, yield and cost", async () => {
  const repository = new InMemoryRecipeCatalogRepository();
  const importRecipes = new ImportRecipes(
    repository,
    new SheetWorkbook(riceSheet()),
  );

  const catalog = await importRecipes.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    authorId: AUTHOR_ID,
    contents: new Uint8Array(),
  });

  const publications = await repository.listPublications(TENANT_ID, BRAND_ID);
  expect(catalog.currentVersion).toBe(1);
  expect(publications).toHaveLength(1);
  expect(publications[0]?.version).toBe(1);
  expect(catalog.publishedVersion(1).ingredients).toEqual([
    {
      id: RICE_ID,
      name: "rice",
      baseUnit: BASE_UNIT.GRAM,
      purchaseUnit: { name: "g", factor: QUANTITY_SCALE },
      recipeUnit: { name: "g", factor: QUANTITY_SCALE },
      referenceCostCop: 12,
    },
  ]);
  expect(catalog.publishedVersion(1).recipes[0]?.lines).toEqual([
    {
      kind: "ingredient",
      ingredientId: RICE_ID,
      netQuantity: 100 * QUANTITY_SCALE,
      yieldPercent: 100,
    },
  ]);
});
