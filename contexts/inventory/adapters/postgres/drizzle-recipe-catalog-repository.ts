import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import {
  ingredients,
  modifierDeltas,
  recipeLines,
  recipePublications,
  recipes,
  recipeVersionLines,
  recipeVersions,
  unitConversions,
} from "#adapters/postgres/schema.js";
import {
  RecipeCatalogRepository,
  type RecipePublication,
} from "#application/ports/recipe-catalog-repository.js";
import {
  BASE_UNIT,
  type BaseUnit,
  type IngredientView,
  type ModifierView,
  type PublishedVersion,
  QUANTITY_SCALE,
  RecipeCatalog,
  type RecipeView,
} from "#domain/recipe-catalog.js";

const CATALOG_ID_PREFIX = "recipe_catalog_";

const LINE_KIND = {
  INGREDIENT: "ingredient",
  RECIPE: "recipe",
} as const;

const UNIT_PURPOSE = {
  PURCHASE: "purchase",
  RECIPE: "recipe",
} as const;

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type PublicationRow = typeof recipePublications.$inferSelect;
type IngredientRow = typeof ingredients.$inferSelect;
type ConversionRow = typeof unitConversions.$inferSelect;
type RecipeVersionRow = typeof recipeVersions.$inferSelect;
type VersionLineRow = typeof recipeVersionLines.$inferSelect;
type ModifierRow = typeof modifierDeltas.$inferSelect;
type RecipeLineView = RecipeView["lines"][number];

interface BrandRows {
  publications: PublicationRow[];
  ingredients: IngredientRow[];
  conversions: ConversionRow[];
  recipeVersions: RecipeVersionRow[];
  versionLines: VersionLineRow[];
  modifiers: ModifierRow[];
}

interface LineRecord {
  position: number;
  kind: (typeof LINE_KIND)[keyof typeof LINE_KIND];
  ingredientId: string | null;
  subRecipeId: string | null;
  netQuantity: number;
  yieldPercent: number;
  stocked: boolean | null;
}

interface ModifierRecord {
  modifierId: string;
  modifierName: string;
  position: number;
  ingredientId: string | null;
  quantity: number | null;
}

export class DrizzleRecipeCatalogRepository extends RecipeCatalogRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async load(
    tenantId: string,
    brandId: string,
  ): Promise<RecipeCatalog | null> {
    return this.inTenant(tenantId, async (tx) => {
      const brand = await readBrand(tx, brandId);
      assertTenant(tenantRows(brand), tenantId);

      if (brand.publications.length === 0) {
        return null;
      }

      const catalog = RecipeCatalog.open({
        id: `${CATALOG_ID_PREFIX}${brandId}`,
        tenantId,
        brandId,
      });

      for (const publication of brand.publications) {
        replay(catalog, snapshotOf(publication, brand));
      }

      return catalog;
    });
  }

  override async save(
    catalog: RecipeCatalog,
    publication: RecipePublication,
  ): Promise<void> {
    if (
      publication.tenantId !== catalog.tenantId ||
      publication.brandId !== catalog.brandId ||
      publication.version !== catalog.currentVersion
    ) {
      throw new Error("The publication does not match the catalog version.");
    }

    await this.inTenant(catalog.tenantId, async (tx) => {
      const existing = await tx
        .select({
          tenantId: recipePublications.tenantId,
          version: recipePublications.version,
        })
        .from(recipePublications)
        .where(eq(recipePublications.brandId, catalog.brandId));

      assertTenant(existing, catalog.tenantId);

      if (existing.some((row) => row.version === publication.version)) {
        throw new Error("That publication version was already stored.");
      }

      const stored = new Set(existing.map((row) => row.version));

      for (let version = 1; version <= catalog.currentVersion; version += 1) {
        if (stored.has(version)) {
          continue;
        }

        await insertVersion(
          tx,
          catalog.tenantId,
          catalog.brandId,
          catalog.publishedVersion(version),
        );
      }

      await replaceCurrent(
        tx,
        catalog.tenantId,
        catalog.brandId,
        catalog.publishedVersion(catalog.currentVersion),
      );
    });
  }

  override async listPublications(
    tenantId: string,
    brandId: string,
  ): Promise<readonly RecipePublication[]> {
    return this.inTenant(tenantId, async (tx) => {
      const brand = await readBrand(tx, brandId);
      assertTenant(tenantRows(brand), tenantId);

      return brand.publications.map((publication) =>
        publicationOf(publication, snapshotOf(publication, brand)),
      );
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE inventory_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

async function readBrand(tx: Transaction, brandId: string): Promise<BrandRows> {
  const publications = await tx
    .select()
    .from(recipePublications)
    .where(eq(recipePublications.brandId, brandId))
    .orderBy(asc(recipePublications.version));
  const ingredientRows = await tx
    .select()
    .from(ingredients)
    .where(eq(ingredients.brandId, brandId));
  const conversions = await tx
    .select()
    .from(unitConversions)
    .where(eq(unitConversions.brandId, brandId));
  const versionRows = await tx
    .select()
    .from(recipeVersions)
    .where(eq(recipeVersions.brandId, brandId));
  const versionLines = await tx
    .select()
    .from(recipeVersionLines)
    .where(eq(recipeVersionLines.brandId, brandId));
  const modifiers = await tx
    .select()
    .from(modifierDeltas)
    .where(eq(modifierDeltas.brandId, brandId));

  return {
    publications,
    ingredients: ingredientRows,
    conversions,
    recipeVersions: versionRows,
    versionLines,
    modifiers,
  };
}

async function insertVersion(
  tx: Transaction,
  tenantId: string,
  brandId: string,
  snapshot: PublishedVersion,
): Promise<void> {
  await tx.insert(recipePublications).values({
    tenantId,
    brandId,
    version: snapshot.number,
    authorId: snapshot.authorId,
  });

  if (snapshot.ingredients.length > 0) {
    await tx.insert(ingredients).values(
      snapshot.ingredients.map((ingredient) => ({
        tenantId,
        brandId,
        version: snapshot.number,
        id: ingredient.id,
        name: ingredient.name,
        baseUnit: ingredient.baseUnit,
        referenceCostCop: ingredient.referenceCostCop,
      })),
    );
    await tx.insert(unitConversions).values(
      snapshot.ingredients.flatMap((ingredient) => [
        {
          tenantId,
          brandId,
          version: snapshot.number,
          ingredientId: ingredient.id,
          purpose: UNIT_PURPOSE.PURCHASE,
          name: ingredient.purchaseUnit.name,
          factor: ingredient.purchaseUnit.factor,
        },
        {
          tenantId,
          brandId,
          version: snapshot.number,
          ingredientId: ingredient.id,
          purpose: UNIT_PURPOSE.RECIPE,
          name: ingredient.recipeUnit.name,
          factor: ingredient.recipeUnit.factor,
        },
      ]),
    );
  }

  if (snapshot.recipes.length > 0) {
    await tx.insert(recipeVersions).values(
      snapshot.recipes.map((recipe) => ({
        tenantId,
        brandId,
        version: snapshot.number,
        recipeId: recipe.id,
        authorId: snapshot.authorId,
        name: recipe.name,
        productId: recipe.productId,
        variantId: recipe.variantId ?? null,
      })),
    );
  }

  const lines = snapshot.recipes.flatMap((recipe) =>
    recipe.lines.map((line, position) => ({
      tenantId,
      brandId,
      version: snapshot.number,
      recipeId: recipe.id,
      ...lineRecord(line, position),
    })),
  );

  if (lines.length > 0) {
    await tx.insert(recipeVersionLines).values(lines);
  }

  const deltas = modifierRecords(snapshot.modifiers).map((modifier) => ({
    tenantId,
    brandId,
    version: snapshot.number,
    ...modifier,
  }));

  if (deltas.length > 0) {
    await tx.insert(modifierDeltas).values(deltas);
  }
}

async function replaceCurrent(
  tx: Transaction,
  tenantId: string,
  brandId: string,
  snapshot: PublishedVersion,
): Promise<void> {
  await tx
    .delete(recipeLines)
    .where(
      and(eq(recipeLines.tenantId, tenantId), eq(recipeLines.brandId, brandId)),
    );
  await tx
    .delete(recipes)
    .where(and(eq(recipes.tenantId, tenantId), eq(recipes.brandId, brandId)));

  if (snapshot.recipes.length > 0) {
    await tx.insert(recipes).values(
      snapshot.recipes.map((recipe) => ({
        tenantId,
        brandId,
        id: recipe.id,
        name: recipe.name,
        productId: recipe.productId,
        variantId: recipe.variantId ?? null,
      })),
    );
  }

  const lines = snapshot.recipes.flatMap((recipe) =>
    recipe.lines.map((line, position) => ({
      tenantId,
      brandId,
      recipeId: recipe.id,
      ...lineRecord(line, position),
    })),
  );

  if (lines.length > 0) {
    await tx.insert(recipeLines).values(lines);
  }
}

function publicationOf(
  row: PublicationRow,
  snapshot: PublishedVersion,
): RecipePublication {
  return {
    tenantId: row.tenantId,
    brandId: row.brandId,
    version: snapshot.number,
    authorId: snapshot.authorId,
    ingredients: snapshot.ingredients,
    recipes: snapshot.recipes,
    modifiers: snapshot.modifiers,
  };
}

function snapshotOf(row: PublicationRow, brand: BrandRows): PublishedVersion {
  const version = row.version;

  return {
    number: version,
    authorId: row.authorId,
    ingredients: ingredientsFrom(
      versionRows(brand.ingredients, version),
      versionRows(brand.conversions, version),
    ),
    recipes: recipesFrom(
      versionRows(brand.recipeVersions, version),
      versionRows(brand.versionLines, version),
    ),
    modifiers: modifiersFrom(versionRows(brand.modifiers, version)),
  };
}

function replay(catalog: RecipeCatalog, snapshot: PublishedVersion): void {
  for (const ingredient of snapshot.ingredients) {
    catalog.upsertIngredient({
      id: ingredient.id,
      name: ingredient.name,
      baseUnit: ingredient.baseUnit,
      purchaseUnit: {
        name: ingredient.purchaseUnit.name,
        baseQuantity: unscale(ingredient.purchaseUnit.factor),
      },
      recipeUnit: {
        name: ingredient.recipeUnit.name,
        baseQuantity: unscale(ingredient.recipeUnit.factor),
      },
      referenceCostCop: ingredient.referenceCostCop,
    });
  }

  for (const recipe of snapshot.recipes) {
    catalog.upsertRecipe({
      id: recipe.id,
      name: recipe.name,
      productId: recipe.productId,
      ...(recipe.variantId !== undefined
        ? { variantId: recipe.variantId }
        : {}),
      lines: recipe.lines.map(commandLine),
    });
  }

  for (const modifier of snapshot.modifiers) {
    catalog.upsertModifier({
      id: modifier.id,
      name: modifier.name,
      deltas: modifier.deltas.map((delta) => ({
        ingredientId: delta.ingredientId,
        quantity: unscale(delta.quantity),
      })),
    });
  }

  const version = catalog.publish({ authorId: snapshot.authorId });

  if (version !== snapshot.number) {
    throw new Error("Stored publication versions are not consecutive.");
  }
}

function ingredientsFrom(
  ingredientRows: readonly IngredientRow[],
  conversionRows: readonly ConversionRow[],
): IngredientView[] {
  return ingredientRows
    .map((row) => {
      const purchase = conversionRows.find(
        (conversion) =>
          conversion.ingredientId === row.id &&
          conversion.purpose === UNIT_PURPOSE.PURCHASE,
      );
      const recipe = conversionRows.find(
        (conversion) =>
          conversion.ingredientId === row.id &&
          conversion.purpose === UNIT_PURPOSE.RECIPE,
      );

      if (purchase === undefined || recipe === undefined) {
        throw new Error("Stored ingredient is missing a unit conversion.");
      }

      return {
        id: row.id,
        name: row.name,
        baseUnit: baseUnitOf(row.baseUnit),
        purchaseUnit: { name: purchase.name, factor: purchase.factor },
        recipeUnit: { name: recipe.name, factor: recipe.factor },
        referenceCostCop: row.referenceCostCop,
      };
    })
    .sort(byId);
}

function recipesFrom(
  headers: readonly RecipeVersionRow[],
  lines: readonly VersionLineRow[],
): RecipeView[] {
  const known = new Set(headers.map((header) => header.recipeId));

  if (lines.some((line) => !known.has(line.recipeId))) {
    throw new Error("Stored recipe line does not belong to a recipe.");
  }

  return headers
    .map((header) => {
      const view = {
        id: header.recipeId,
        name: header.name,
        productId: header.productId,
        lines: lines
          .filter((line) => line.recipeId === header.recipeId)
          .sort((left, right) => left.position - right.position)
          .map(lineView),
      };

      if (header.variantId === null) {
        return view;
      }

      return { ...view, variantId: header.variantId };
    })
    .sort(byId);
}

function modifiersFrom(rows: readonly ModifierRow[]): ModifierView[] {
  const grouped = new Map<string, ModifierRow[]>();

  for (const row of rows) {
    const group = grouped.get(row.modifierId);

    if (group === undefined) {
      grouped.set(row.modifierId, [row]);
      continue;
    }

    group.push(row);
  }

  return [...grouped.entries()]
    .map(([id, group]) => {
      const ordered = group.toSorted(
        (left, right) => left.position - right.position,
      );
      const name = ordered[0]?.modifierName;

      if (name === undefined) {
        throw new Error("Stored modifier is missing its name.");
      }

      return {
        id,
        name,
        deltas: ordered.flatMap((row) => {
          if (row.ingredientId === null || row.quantity === null) {
            return [];
          }

          return [{ ingredientId: row.ingredientId, quantity: row.quantity }];
        }),
      };
    })
    .sort(byId);
}

function lineView(line: VersionLineRow): RecipeLineView {
  if (line.kind === LINE_KIND.INGREDIENT) {
    if (line.ingredientId === null) {
      throw new Error("Stored ingredient line is missing its ingredient.");
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

function commandLine(line: RecipeLineView) {
  const netQuantity = unscale(line.netQuantity);

  if (line.kind === LINE_KIND.INGREDIENT) {
    return {
      kind: LINE_KIND.INGREDIENT,
      ingredientId: line.ingredientId,
      netQuantity,
      yieldPercent: line.yieldPercent,
    };
  }

  return {
    kind: LINE_KIND.RECIPE,
    recipeId: line.recipeId,
    netQuantity,
    yieldPercent: line.yieldPercent,
    stocked: line.stocked,
  };
}

function lineRecord(line: RecipeLineView, position: number): LineRecord {
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

function modifierRecords(modifiers: readonly ModifierView[]): ModifierRecord[] {
  const records: ModifierRecord[] = [];

  for (const modifier of modifiers) {
    if (modifier.deltas.length === 0) {
      records.push({
        modifierId: modifier.id,
        modifierName: modifier.name,
        position: 0,
        ingredientId: null,
        quantity: null,
      });
      continue;
    }

    for (const [position, delta] of modifier.deltas.entries()) {
      records.push({
        modifierId: modifier.id,
        modifierName: modifier.name,
        position,
        ingredientId: delta.ingredientId,
        quantity: delta.quantity,
      });
    }
  }

  return records;
}

function versionRows<Row extends { version: number }>(
  rows: readonly Row[],
  version: number,
): Row[] {
  return rows.filter((row) => row.version === version);
}

function tenantRows(brand: BrandRows): readonly { tenantId: string }[] {
  return [
    ...brand.publications,
    ...brand.ingredients,
    ...brand.conversions,
    ...brand.recipeVersions,
    ...brand.versionLines,
    ...brand.modifiers,
  ];
}

function assertTenant(
  rows: readonly { tenantId: string }[],
  tenantId: string,
): void {
  if (rows.some((row) => row.tenantId !== tenantId)) {
    throw new Error("Stored recipe catalog does not match the tenant.");
  }
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

function unscale(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity % QUANTITY_SCALE !== 0) {
    throw new Error("Stored quantity is not a whole number of base units.");
  }

  return quantity / QUANTITY_SCALE;
}

function byId(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}
