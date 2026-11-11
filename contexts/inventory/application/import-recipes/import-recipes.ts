import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import {
  type RecipeWorkbook,
  type RecipeWorkbookSheet,
  WORKBOOK_LINE_KIND,
  type WorkbookLine,
} from "#application/ports/recipe-workbook.js";
import { savePublishedVersion } from "#application/save-published-version/save-published-version.js";
import { RecipeCatalog } from "#domain/recipe-catalog.js";

export interface ImportRowFailure {
  row: number;
  reason: string;
}

export class RecipeImportRejected extends Error {
  readonly rows: readonly ImportRowFailure[];

  constructor(rows: readonly ImportRowFailure[]) {
    super("The workbook was rejected.");
    this.name = "RecipeImportRejected";
    this.rows = rows;
  }
}

export interface ImportRecipesInput {
  tenantId: string;
  brandId: string;
  authorId: string;
  contents: Uint8Array;
}

const LINE_KIND = {
  INGREDIENT: "ingredient",
  RECIPE: "recipe",
} as const;

interface GroupedRecipe {
  id: string;
  name: string;
  productId: string;
  variantId?: string;
  lines: WorkbookLine[];
}

const knownRecipeIds = (catalog: RecipeCatalog | null): Set<string> => {
  if (catalog === null || catalog.currentVersion === 0) {
    return new Set();
  }

  return new Set(
    catalog
      .publishedVersion(catalog.currentVersion)
      .recipes.map((recipe) => recipe.id),
  );
};

const rowFailures = (
  catalog: RecipeCatalog | null,
  sheet: RecipeWorkbookSheet,
): ImportRowFailure[] => {
  const ingredients = new Set(
    (catalog?.ingredients ?? []).map((ingredient) => ingredient.id),
  );

  for (const ingredient of sheet.ingredients) {
    ingredients.add(ingredient.id);
  }

  const recipes = knownRecipeIds(catalog);

  for (const line of sheet.lines) {
    recipes.add(line.recipeId);
  }

  const failures: ImportRowFailure[] = [];

  for (const line of sheet.lines) {
    if (
      line.kind === WORKBOOK_LINE_KIND.INGREDIENT &&
      !ingredients.has(line.ingredientId)
    ) {
      failures.push({ row: line.row, reason: "Unknown ingredient." });
    }

    if (
      line.kind === WORKBOOK_LINE_KIND.RECIPE &&
      !recipes.has(line.subRecipeId)
    ) {
      failures.push({ row: line.row, reason: "Unknown recipe." });
    }
  }

  return failures;
};

const groupRecipes = (lines: readonly WorkbookLine[]): GroupedRecipe[] => {
  const groups = new Map<string, GroupedRecipe>();

  for (const line of lines) {
    const existing = groups.get(line.recipeId);
    const group = existing ?? {
      id: line.recipeId,
      name: line.recipeName,
      productId: line.productId,
      lines: [],
      ...(line.variantId === undefined ? {} : { variantId: line.variantId }),
    };
    group.lines.push(line);
    groups.set(line.recipeId, group);
  }

  return [...groups.values()];
};

const applySheet = (
  catalog: RecipeCatalog,
  sheet: RecipeWorkbookSheet,
): void => {
  for (const ingredient of sheet.ingredients) {
    catalog.upsertIngredient({
      id: ingredient.id,
      name: ingredient.name,
      baseUnit: ingredient.baseUnit,
      purchaseUnit: ingredient.purchaseUnit,
      recipeUnit: ingredient.recipeUnit,
      referenceCostCop: ingredient.referenceCostCop,
    });
  }

  for (const recipe of groupRecipes(sheet.lines)) {
    catalog.upsertRecipe({
      id: recipe.id,
      name: recipe.name,
      productId: recipe.productId,
      ...(recipe.variantId === undefined
        ? {}
        : { variantId: recipe.variantId }),
      lines: recipe.lines.map((line) =>
        line.kind === LINE_KIND.INGREDIENT
          ? {
              kind: LINE_KIND.INGREDIENT,
              ingredientId: line.ingredientId,
              netQuantity: line.netQuantity,
              yieldPercent: line.yieldPercent,
            }
          : {
              kind: LINE_KIND.RECIPE,
              recipeId: line.subRecipeId,
              netQuantity: line.netQuantity,
              yieldPercent: line.yieldPercent,
              stocked: line.stocked,
            },
      ),
    });
  }
};

export class ImportRecipes {
  constructor(
    private readonly catalogs: RecipeCatalogRepository,
    private readonly workbook: RecipeWorkbook,
  ) {}

  async execute(input: ImportRecipesInput): Promise<RecipeCatalog> {
    const sheet = await this.workbook.read(input.contents);
    const loaded = await this.catalogs.load(input.tenantId, input.brandId);
    const failures = rowFailures(loaded, sheet);

    if (failures.length > 0) {
      throw new RecipeImportRejected(failures);
    }

    const catalog =
      loaded ??
      RecipeCatalog.open({
        id: `recipe_catalog_${input.brandId}`,
        tenantId: input.tenantId,
        brandId: input.brandId,
      });
    applySheet(catalog, sheet);
    await savePublishedVersion(this.catalogs, catalog, input.authorId);
    return catalog;
  }
}
