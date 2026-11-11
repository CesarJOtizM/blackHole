import { expect, it } from "vitest";

import { InMemoryRecipeCatalogRepository } from "#adapters/memory/in-memory-recipe-catalog-repository.js";
import { SitePrice } from "#application/ports/site-price.js";
import { VenueDirectory } from "#application/ports/venue-directory.js";
import { UpdateRecipeCatalog } from "#application/update-recipe-catalog/update-recipe-catalog.js";
import { ViewTheoreticalCost } from "#application/view-theoretical-cost/view-theoretical-cost.js";
import { BASE_UNIT } from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const VENUE_ID = "organization_venue_1";
const AUTHOR_ID = "user_owner";
const ONION_ID = "ingredient_onion";
const BUTTER_ID = "ingredient_butter";
const BURGER_ID = "product_burger";
const BURGER_RECIPE_ID = "recipe_burger";
const BECHAMEL_ID = "recipe_bechamel";
const LASAGNA_ID = "product_lasagna";
const LASAGNA_RECIPE_ID = "recipe_lasagna";

class BrandDirectory extends VenueDirectory {
  override async brandOf(
    _tenantId: string,
    _venueId: string,
  ): Promise<string | null> {
    return BRAND_ID;
  }
}

class PriceList extends SitePrice {
  constructor(private readonly prices: Readonly<Record<string, number>>) {
    super();
  }

  override async priceOf(
    _tenantId: string,
    _venueId: string,
    productId: string,
    _variantId?: string,
  ): Promise<number | null> {
    return this.prices[productId] ?? null;
  }
}

it("given exploded cost 8000 COP and price 20000 COP, when an administrator views the dish, then cost 8000 and margin 60 are shown", async () => {
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
            netQuantity: 100,
            yieldPercent: 100,
          },
        ],
      },
    ],
  });
  const view = new ViewTheoreticalCost(
    repository,
    new BrandDirectory(),
    new PriceList({ [BURGER_ID]: 20_000 }),
  );

  const cost = await view.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: BURGER_ID,
  });

  expect(cost).toEqual({ costCop: 8000, marginPercent: 60 });
});

it("given a stocked sub-recipe, when the dish is costed, then the cost comes from the sub-recipe ingredients", async () => {
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
  const view = new ViewTheoreticalCost(
    repository,
    new BrandDirectory(),
    new PriceList({ [LASAGNA_ID]: 2_000 }),
  );

  const cost = await view.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: LASAGNA_ID,
  });

  expect(cost).toEqual({ costCop: 800, marginPercent: 60 });
});
