import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import type { SitePrice } from "#application/ports/site-price.js";
import type { VenueDirectory } from "#application/ports/venue-directory.js";
import {
  type ExplodedQuantity,
  type IngredientView,
  QUANTITY_SCALE,
  type RecipeCatalog,
  RecipeCycle,
  type RecipeView,
  UnknownIngredient,
  UnknownRecipe,
} from "#domain/recipe-catalog.js";

export interface ViewTheoreticalCostInput {
  tenantId: string;
  venueId: string;
  productId: string;
  variantId?: string;
}

export interface TheoreticalCost {
  costCop: number;
  marginPercent: number;
}

export class UnknownVenue extends Error {
  constructor() {
    super("The venue does not belong to a brand.");
    this.name = "UnknownVenue";
  }
}

export class MissingSitePrice extends Error {
  constructor() {
    super("The site has no price for that product.");
    this.name = "MissingSitePrice";
  }
}

interface CostIndex {
  ingredients: ReadonlyMap<string, IngredientView>;
  recipes: ReadonlyMap<string, RecipeView>;
}

const ingredientCost = (ingredient: IngredientView, quantity: number): number =>
  Math.floor(
    (quantity * ingredient.referenceCostCop) / ingredient.purchaseUnit.factor,
  );

const costExploded = (
  catalog: RecipeCatalog,
  version: number,
  index: CostIndex,
  lines: readonly ExplodedQuantity[],
  visiting: Set<string>,
): number => {
  let total = 0;

  for (const line of lines) {
    const ingredient = index.ingredients.get(line.ingredientId);

    if (ingredient) {
      total += ingredientCost(ingredient, line.quantity);
      continue;
    }

    const recipe = index.recipes.get(line.ingredientId);

    if (!recipe) {
      throw new UnknownIngredient();
    }

    if (visiting.has(recipe.id)) {
      throw new RecipeCycle([recipe.name, recipe.name]);
    }

    visiting.add(recipe.id);
    const batch = costExploded(
      catalog,
      version,
      index,
      catalog.explode({
        productId: recipe.productId,
        version,
        ...(recipe.variantId === undefined
          ? {}
          : { variantId: recipe.variantId }),
      }),
      visiting,
    );
    visiting.delete(recipe.id);
    total += Math.floor((batch * line.quantity) / QUANTITY_SCALE);
  }

  return total;
};

export class ViewTheoreticalCost {
  constructor(
    private readonly catalogs: RecipeCatalogRepository,
    private readonly venues: VenueDirectory,
    private readonly prices: SitePrice,
  ) {}

  async execute(input: ViewTheoreticalCostInput): Promise<TheoreticalCost> {
    const brandId = await this.venues.brandOf(input.tenantId, input.venueId);

    if (brandId === null) {
      throw new UnknownVenue();
    }

    const [catalog, price] = await Promise.all([
      this.catalogs.load(input.tenantId, brandId),
      this.prices.priceOf(
        input.tenantId,
        input.venueId,
        input.productId,
        input.variantId,
      ),
    ]);

    if (catalog === null || catalog.currentVersion === 0) {
      throw new UnknownRecipe();
    }

    if (price === null || price <= 0) {
      throw new MissingSitePrice();
    }

    const version = catalog.currentVersion;
    const published = catalog.publishedVersion(version);
    const costCop = costExploded(
      catalog,
      version,
      {
        ingredients: new Map(
          published.ingredients.map((ingredient) => [
            ingredient.id,
            ingredient,
          ]),
        ),
        recipes: new Map(
          published.recipes.map((recipe) => [recipe.id, recipe]),
        ),
      },
      catalog.explode({
        productId: input.productId,
        version,
        ...(input.variantId === undefined
          ? {}
          : { variantId: input.variantId }),
      }),
      new Set(),
    );

    return {
      costCop,
      marginPercent: Math.trunc(((price - costCop) * 100) / price),
    };
  }
}
