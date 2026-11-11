import { expect, it } from "vitest";

import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import {
  BASE_UNIT,
  QUANTITY_SCALE,
  RecipeCatalog,
} from "#domain/recipe-catalog.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const BRAND_ID = "organization_brand_shared";
const OTHER_BRAND_ID = "organization_brand_other";
const AUTHOR_ID = "user_owner";
const ONION_ID = "ingredient_onion";
const CHEESE_ID = "ingredient_cheese";
const BURGER_ID = "product_burger";
const EXTRA_CHEESE_ID = "modifier_extra_cheese";

const publishedCatalog = (tenantId: string, recipeId: string) => {
  const catalog = RecipeCatalog.open({
    id: `recipe_catalog_${BRAND_ID}`,
    tenantId,
    brandId: BRAND_ID,
  });
  catalog.upsertIngredient({
    id: ONION_ID,
    name: "onion",
    baseUnit: BASE_UNIT.GRAM,
    purchaseUnit: { name: "g", baseQuantity: 1 },
    recipeUnit: { name: "g", baseQuantity: 1 },
    referenceCostCop: 80,
  });
  catalog.upsertRecipe({
    id: recipeId,
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
  catalog.upsertModifier({
    id: EXTRA_CHEESE_ID,
    name: "extra cheese",
    deltas: [{ ingredientId: CHEESE_ID, quantity: 30 }],
  });
  const version = catalog.publish({ authorId: AUTHOR_ID });
  const published = catalog.publishedVersion(version);

  return {
    catalog,
    publication: {
      tenantId,
      brandId: BRAND_ID,
      version,
      authorId: published.authorId,
      ingredients: published.ingredients,
      recipes: published.recipes,
      modifiers: published.modifiers,
    },
  };
};

export function recipeCatalogRepositoryContract(
  createRepository: () =>
    | RecipeCatalogRepository
    | Promise<RecipeCatalogRepository>,
): void {
  it("given a published catalog, when it is saved, then the same catalog and publication can be read back", async () => {
    const repository = await createRepository();
    const { catalog, publication } = publishedCatalog(
      TENANT_A,
      "recipe_burger",
    );

    await repository.save(catalog, publication);

    const stored = await repository.load(TENANT_A, BRAND_ID);
    expect(stored).toBeInstanceOf(RecipeCatalog);
    expect(stored?.id).toBe(catalog.id);
    expect(stored?.tenantId).toBe(catalog.tenantId);
    expect(stored?.brandId).toBe(catalog.brandId);
    expect(stored?.currentVersion).toBe(1);
    expect(stored?.publishedVersion(1)).toEqual(catalog.publishedVersion(1));
    expect(stored?.explode({ productId: BURGER_ID })).toEqual([
      { ingredientId: ONION_ID, quantity: 200 * QUANTITY_SCALE },
    ]);
    expect(
      stored?.explode({
        productId: BURGER_ID,
        modifierIds: [EXTRA_CHEESE_ID],
      }),
    ).toEqual([
      { ingredientId: CHEESE_ID, quantity: 30 * QUANTITY_SCALE },
      { ingredientId: ONION_ID, quantity: 200 * QUANTITY_SCALE },
    ]);
    expect(await repository.listPublications(TENANT_A, BRAND_ID)).toEqual([
      publication,
    ]);
    expect(await repository.load(TENANT_A, OTHER_BRAND_ID)).toBeNull();
    expect(await repository.listPublications(TENANT_A, OTHER_BRAND_ID)).toEqual(
      [],
    );
  });

  it("given tenants A and B, when tenant A loads its catalog, then B stays hidden", async () => {
    const repository = await createRepository();
    const brandA = publishedCatalog(TENANT_A, "recipe_a");
    const brandB = publishedCatalog(TENANT_B, "recipe_b");

    await repository.save(brandA.catalog, brandA.publication);
    await repository.save(brandB.catalog, brandB.publication);

    const loadedA = await repository.load(TENANT_A, BRAND_ID);
    const loadedB = await repository.load(TENANT_B, BRAND_ID);
    expect(loadedA).toBeInstanceOf(RecipeCatalog);
    expect(loadedB).toBeInstanceOf(RecipeCatalog);
    expect(
      loadedA?.publishedVersion(1).recipes.map((recipe) => recipe.id),
    ).toEqual(["recipe_a"]);
    expect(
      loadedA?.publishedVersion(1).recipes.map((recipe) => recipe.id),
    ).not.toContain("recipe_b");
    expect(
      loadedB?.publishedVersion(1).recipes.map((recipe) => recipe.id),
    ).toEqual(["recipe_b"]);
    expect(
      loadedB?.publishedVersion(1).recipes.map((recipe) => recipe.id),
    ).not.toContain("recipe_a");
    expect(await repository.listPublications(TENANT_A, BRAND_ID)).toEqual([
      brandA.publication,
    ]);
    expect(await repository.listPublications(TENANT_B, BRAND_ID)).toEqual([
      brandB.publication,
    ]);
    expect(await repository.load(TENANT_B, OTHER_BRAND_ID)).toBeNull();
    expect(await repository.listPublications(TENANT_B, OTHER_BRAND_ID)).toEqual(
      [],
    );
  });
}
