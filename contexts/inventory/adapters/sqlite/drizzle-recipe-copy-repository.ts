import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { type AnyColumn, and, asc, eq } from "drizzle-orm";
import { createNodeSqliteDatabase } from "#adapters/sqlite/node-sqlite-database.js";
import {
  recipeCopies,
  recipeCopyDeltas,
  recipeCopyIngredients,
  recipeCopyLines,
  recipeCopyModifiers,
  recipeCopyRecipes,
  recipeCopyUnits,
} from "#adapters/sqlite/schema.js";
import type { RecipePublication } from "#application/ports/recipe-catalog-repository.js";
import { RecipeCopyRepository } from "#application/ports/recipe-copy-repository.js";
import {
  BASE_UNIT,
  type BaseUnit,
  type IngredientView,
  type ModifierView,
  type RecipeView,
} from "#domain/recipe-catalog.js";

const LINE_KIND = {
  INGREDIENT: "ingredient",
  RECIPE: "recipe",
} as const;

const UNIT_PURPOSE = {
  PURCHASE: "purchase",
  RECIPE: "recipe",
} as const;

type Database = ReturnType<typeof createNodeSqliteDatabase>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type CopyRow = typeof recipeCopies.$inferSelect;
type IngredientRow = typeof recipeCopyIngredients.$inferSelect;
type UnitRow = typeof recipeCopyUnits.$inferSelect;
type RecipeRow = typeof recipeCopyRecipes.$inferSelect;
type LineRow = typeof recipeCopyLines.$inferSelect;
type ModifierRow = typeof recipeCopyModifiers.$inferSelect;
type DeltaRow = typeof recipeCopyDeltas.$inferSelect;
type RecipeLineView = RecipeView["lines"][number];

const migrationSql = readFileSync(
  fileURLToPath(new URL("./0001_recipe_copy.sql", import.meta.url)),
  "utf8",
);

export function prepareRecipeCopyDatabase(client: DatabaseSync): void {
  const existing = client
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recipe_copies'",
    )
    .get();

  if (existing === undefined) {
    client.exec(migrationSql);
  }

  const outputQuantity = client
    .prepare(
      "SELECT name FROM pragma_table_info('recipe_copy_recipes') WHERE name = 'output_quantity'",
    )
    .get();

  if (outputQuantity === undefined) {
    client.exec(
      "ALTER TABLE recipe_copy_recipes ADD COLUMN output_quantity integer",
    );
  }
}

interface CopyRows {
  ingredients: IngredientRow[];
  units: UnitRow[];
  recipes: RecipeRow[];
  lines: LineRow[];
  modifiers: ModifierRow[];
  deltas: DeltaRow[];
}

export class DrizzleRecipeCopyRepository extends RecipeCopyRepository {
  private readonly database: Database;

  constructor(client: DatabaseSync) {
    super();
    this.database = createNodeSqliteDatabase(client);
  }

  override async load(
    tenantId: string,
    brandId: string,
  ): Promise<RecipePublication | null> {
    return this.database.transaction((tx) => readCopy(tx, tenantId, brandId));
  }

  override async apply(
    publication: RecipePublication,
  ): Promise<RecipePublication> {
    return this.database.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(recipeCopies)
        .where(
          forBrand(recipeCopies, publication.tenantId, publication.brandId),
        );

      const stored = current[0];

      if (stored && publication.version <= stored.version) {
        return requiredCopy(tx, publication.tenantId, publication.brandId);
      }

      await replaceCopy(tx, publication);

      return requiredCopy(tx, publication.tenantId, publication.brandId);
    });
  }
}

async function readCopy(
  tx: Transaction,
  tenantId: string,
  brandId: string,
): Promise<RecipePublication | null> {
  const headers = await tx
    .select()
    .from(recipeCopies)
    .where(forBrand(recipeCopies, tenantId, brandId));
  const header = headers[0];

  if (header === undefined) {
    return null;
  }

  return publicationOf(header, await readRows(tx, tenantId, brandId));
}

async function requiredCopy(
  tx: Transaction,
  tenantId: string,
  brandId: string,
): Promise<RecipePublication> {
  const copy = await readCopy(tx, tenantId, brandId);

  if (copy === null) {
    throw new Error("Stored recipe copy is missing.");
  }

  return copy;
}

async function readRows(
  tx: Transaction,
  tenantId: string,
  brandId: string,
): Promise<CopyRows> {
  return {
    ingredients: await tx
      .select()
      .from(recipeCopyIngredients)
      .where(forBrand(recipeCopyIngredients, tenantId, brandId))
      .orderBy(asc(recipeCopyIngredients.position)),
    units: await tx
      .select()
      .from(recipeCopyUnits)
      .where(forBrand(recipeCopyUnits, tenantId, brandId)),
    recipes: await tx
      .select()
      .from(recipeCopyRecipes)
      .where(forBrand(recipeCopyRecipes, tenantId, brandId))
      .orderBy(asc(recipeCopyRecipes.position)),
    lines: await tx
      .select()
      .from(recipeCopyLines)
      .where(forBrand(recipeCopyLines, tenantId, brandId))
      .orderBy(asc(recipeCopyLines.position)),
    modifiers: await tx
      .select()
      .from(recipeCopyModifiers)
      .where(forBrand(recipeCopyModifiers, tenantId, brandId))
      .orderBy(asc(recipeCopyModifiers.position)),
    deltas: await tx
      .select()
      .from(recipeCopyDeltas)
      .where(forBrand(recipeCopyDeltas, tenantId, brandId))
      .orderBy(asc(recipeCopyDeltas.position)),
  };
}

async function replaceCopy(
  tx: Transaction,
  publication: RecipePublication,
): Promise<void> {
  const tenantId = publication.tenantId;
  const brandId = publication.brandId;

  await tx
    .delete(recipeCopyDeltas)
    .where(forBrand(recipeCopyDeltas, tenantId, brandId));
  await tx
    .delete(recipeCopyLines)
    .where(forBrand(recipeCopyLines, tenantId, brandId));
  await tx
    .delete(recipeCopyUnits)
    .where(forBrand(recipeCopyUnits, tenantId, brandId));
  await tx
    .delete(recipeCopyIngredients)
    .where(forBrand(recipeCopyIngredients, tenantId, brandId));
  await tx
    .delete(recipeCopyRecipes)
    .where(forBrand(recipeCopyRecipes, tenantId, brandId));
  await tx
    .delete(recipeCopyModifiers)
    .where(forBrand(recipeCopyModifiers, tenantId, brandId));
  await tx
    .delete(recipeCopies)
    .where(forBrand(recipeCopies, tenantId, brandId));

  await tx.insert(recipeCopies).values({
    tenantId,
    brandId,
    version: publication.version,
    authorId: publication.authorId,
  });

  if (publication.ingredients.length > 0) {
    await tx.insert(recipeCopyIngredients).values(
      publication.ingredients.map((ingredient, position) => ({
        tenantId,
        brandId,
        position,
        id: ingredient.id,
        name: ingredient.name,
        baseUnit: ingredient.baseUnit,
        referenceCostCop: ingredient.referenceCostCop,
      })),
    );
    await tx.insert(recipeCopyUnits).values(
      publication.ingredients.flatMap((ingredient) => [
        {
          tenantId,
          brandId,
          ingredientId: ingredient.id,
          purpose: UNIT_PURPOSE.PURCHASE,
          name: ingredient.purchaseUnit.name,
          factor: ingredient.purchaseUnit.factor,
        },
        {
          tenantId,
          brandId,
          ingredientId: ingredient.id,
          purpose: UNIT_PURPOSE.RECIPE,
          name: ingredient.recipeUnit.name,
          factor: ingredient.recipeUnit.factor,
        },
      ]),
    );
  }

  if (publication.recipes.length > 0) {
    await tx.insert(recipeCopyRecipes).values(
      publication.recipes.map((recipe, position) => ({
        tenantId,
        brandId,
        position,
        id: recipe.id,
        name: recipe.name,
        productId: recipe.productId,
        variantId: recipe.variantId ?? null,
      })),
    );
  }

  const lines = publication.recipes.flatMap((recipe) =>
    recipe.lines.map((line, position) => ({
      tenantId,
      brandId,
      recipeId: recipe.id,
      ...lineRecord(line, position),
    })),
  );

  if (lines.length > 0) {
    await tx.insert(recipeCopyLines).values(lines);
  }

  if (publication.modifiers.length > 0) {
    await tx.insert(recipeCopyModifiers).values(
      publication.modifiers.map((modifier, position) => ({
        tenantId,
        brandId,
        position,
        id: modifier.id,
        name: modifier.name,
      })),
    );
  }

  const deltas = publication.modifiers.flatMap((modifier) =>
    modifier.deltas.map((delta, position) => ({
      tenantId,
      brandId,
      modifierId: modifier.id,
      position,
      ingredientId: delta.ingredientId,
      quantity: delta.quantity,
    })),
  );

  if (deltas.length > 0) {
    await tx.insert(recipeCopyDeltas).values(deltas);
  }
}

function publicationOf(header: CopyRow, rows: CopyRows): RecipePublication {
  return {
    tenantId: header.tenantId,
    brandId: header.brandId,
    version: header.version,
    authorId: header.authorId,
    ingredients: ingredientsFrom(rows.ingredients, rows.units),
    recipes: recipesFrom(rows.recipes, rows.lines),
    modifiers: modifiersFrom(rows.modifiers, rows.deltas),
  };
}

function ingredientsFrom(
  ingredients: readonly IngredientRow[],
  units: readonly UnitRow[],
): IngredientView[] {
  return ingredients.map((ingredient) => {
    const purchase = units.find(
      (unit) =>
        unit.ingredientId === ingredient.id &&
        unit.purpose === UNIT_PURPOSE.PURCHASE,
    );
    const recipe = units.find(
      (unit) =>
        unit.ingredientId === ingredient.id &&
        unit.purpose === UNIT_PURPOSE.RECIPE,
    );

    if (purchase === undefined || recipe === undefined) {
      throw new Error("Stored ingredient is missing a unit conversion.");
    }

    return {
      id: ingredient.id,
      name: ingredient.name,
      baseUnit: baseUnitOf(ingredient.baseUnit),
      purchaseUnit: { name: purchase.name, factor: purchase.factor },
      recipeUnit: { name: recipe.name, factor: recipe.factor },
      referenceCostCop: ingredient.referenceCostCop,
    };
  });
}

function recipesFrom(
  recipes: readonly RecipeRow[],
  lines: readonly LineRow[],
): RecipeView[] {
  return recipes.map((recipe) => {
    const view = {
      id: recipe.id,
      name: recipe.name,
      productId: recipe.productId,
      lines: lines
        .filter((line) => line.recipeId === recipe.id)
        .sort((left, right) => left.position - right.position)
        .map(lineView),
    };

    if (recipe.variantId === null) {
      return view;
    }

    return { ...view, variantId: recipe.variantId };
  });
}

function modifiersFrom(
  modifiers: readonly ModifierRow[],
  deltas: readonly DeltaRow[],
): ModifierView[] {
  return modifiers.map((modifier) => ({
    id: modifier.id,
    name: modifier.name,
    deltas: deltas
      .filter((delta) => delta.modifierId === modifier.id)
      .sort((left, right) => left.position - right.position)
      .map((delta) => ({
        ingredientId: delta.ingredientId,
        quantity: delta.quantity,
      })),
  }));
}

function lineView(line: LineRow): RecipeLineView {
  if (line.kind === LINE_KIND.INGREDIENT) {
    if (line.ingredientId === null || line.stocked !== null) {
      throw new Error("Stored ingredient line is incomplete.");
    }

    return {
      kind: LINE_KIND.INGREDIENT,
      ingredientId: line.ingredientId,
      netQuantity: line.netQuantity,
      yieldPercent: line.yieldPercent,
    };
  }

  if (
    line.kind !== LINE_KIND.RECIPE ||
    line.subRecipeId === null ||
    line.stocked === null
  ) {
    throw new Error("Stored recipe line is incomplete.");
  }

  return {
    kind: LINE_KIND.RECIPE,
    recipeId: line.subRecipeId,
    netQuantity: line.netQuantity,
    yieldPercent: line.yieldPercent,
    stocked: line.stocked,
  };
}

function lineRecord(line: RecipeLineView, position: number) {
  if (line.kind === LINE_KIND.INGREDIENT) {
    return {
      position,
      kind: LINE_KIND.INGREDIENT,
      ingredientId: line.ingredientId,
      subRecipeId: null,
      netQuantity: line.netQuantity,
      yieldPercent: line.yieldPercent,
      stocked: null,
    };
  }

  return {
    position,
    kind: LINE_KIND.RECIPE,
    ingredientId: null,
    subRecipeId: line.recipeId,
    netQuantity: line.netQuantity,
    yieldPercent: line.yieldPercent,
    stocked: line.stocked,
  };
}

function forBrand(
  table: { tenantId: AnyColumn; brandId: AnyColumn },
  tenantId: string,
  brandId: string,
) {
  return and(eq(table.tenantId, tenantId), eq(table.brandId, brandId));
}

function baseUnitOf(value: string): BaseUnit {
  if (
    value === BASE_UNIT.GRAM ||
    value === BASE_UNIT.MILLILITRE ||
    value === BASE_UNIT.UNIT
  ) {
    return value;
  }

  throw new Error("Stored ingredient has an unknown base unit.");
}
