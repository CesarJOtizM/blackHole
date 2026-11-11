import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import { savePublishedVersion } from "#application/save-published-version/save-published-version.js";
import { type BaseUnit, RecipeCatalog } from "#domain/recipe-catalog.js";

const CATALOG_COMMAND = {
  UPSERT_INGREDIENT: "upsertIngredient",
  UPSERT_RECIPE: "upsertRecipe",
} as const;

const LINE_KIND = {
  INGREDIENT: "ingredient",
  RECIPE: "recipe",
} as const;

export interface CatalogUnit {
  name: string;
  baseQuantity: number;
}

export interface IngredientLine {
  kind: typeof LINE_KIND.INGREDIENT;
  ingredientId: string;
  netQuantity: number;
  yieldPercent?: number;
}

export interface SubRecipeLine {
  kind: typeof LINE_KIND.RECIPE;
  recipeId: string;
  netQuantity: number;
  yieldPercent?: number;
  stocked: boolean;
}

export type CatalogLine = IngredientLine | SubRecipeLine;

interface UpsertIngredientCommand {
  type: typeof CATALOG_COMMAND.UPSERT_INGREDIENT;
  id: string;
  name: string;
  baseUnit: BaseUnit;
  purchaseUnit: CatalogUnit;
  recipeUnit: CatalogUnit;
  referenceCostCop: number;
}

interface UpsertRecipeCommand {
  type: typeof CATALOG_COMMAND.UPSERT_RECIPE;
  id: string;
  name: string;
  productId: string;
  variantId?: string;
  lines: readonly CatalogLine[];
}

export type CatalogCommand = UpsertIngredientCommand | UpsertRecipeCommand;

export interface UpdateRecipeCatalogInput {
  tenantId: string;
  brandId: string;
  authorId: string;
  commands: readonly CatalogCommand[];
}

const assertNever = (command: never): never => {
  throw command;
};

const applyCommand = (
  catalog: RecipeCatalog,
  command: CatalogCommand,
): void => {
  switch (command.type) {
    case CATALOG_COMMAND.UPSERT_INGREDIENT:
      catalog.upsertIngredient({
        id: command.id,
        name: command.name,
        baseUnit: command.baseUnit,
        purchaseUnit: command.purchaseUnit,
        recipeUnit: command.recipeUnit,
        referenceCostCop: command.referenceCostCop,
      });
      return;
    case CATALOG_COMMAND.UPSERT_RECIPE:
      catalog.upsertRecipe({
        id: command.id,
        name: command.name,
        productId: command.productId,
        lines: command.lines,
        ...(command.variantId === undefined
          ? {}
          : { variantId: command.variantId }),
      });
      return;
    default:
      assertNever(command);
  }
};

const openCatalog = (input: UpdateRecipeCatalogInput): RecipeCatalog =>
  RecipeCatalog.open({
    id: `recipe_catalog_${input.brandId}`,
    tenantId: input.tenantId,
    brandId: input.brandId,
  });

export class UpdateRecipeCatalog {
  constructor(private readonly catalogs: RecipeCatalogRepository) {}

  async execute(input: UpdateRecipeCatalogInput): Promise<RecipeCatalog> {
    const loaded = await this.catalogs.load(input.tenantId, input.brandId);
    const catalog = loaded ?? openCatalog(input);

    for (const command of input.commands) {
      applyCommand(catalog, command);
    }

    await savePublishedVersion(this.catalogs, catalog, input.authorId);
    return catalog;
  }
}
