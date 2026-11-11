import { z } from "zod";

const CATALOG_COMMAND = {
  UPSERT_INGREDIENT: "upsertIngredient",
  UPSERT_RECIPE: "upsertRecipe",
} as const;

const LINE_KIND = {
  INGREDIENT: "ingredient",
  RECIPE: "recipe",
} as const;

const BASE_UNIT = {
  GRAM: "g",
  MILLILITRE: "ml",
  UNIT: "unit",
} as const;

const baseUnit = z.enum(BASE_UNIT);

const catalogUnit = z
  .object({
    name: z.string().min(1),
    baseQuantity: z.number().int(),
  })
  .strict();

const ingredientLine = z
  .object({
    kind: z.literal(LINE_KIND.INGREDIENT),
    ingredientId: z.string().min(1),
    netQuantity: z.number().int(),
    yieldPercent: z.number().int().optional(),
  })
  .strict();

const subRecipeLine = z
  .object({
    kind: z.literal(LINE_KIND.RECIPE),
    recipeId: z.string().min(1),
    netQuantity: z.number().int(),
    yieldPercent: z.number().int().optional(),
    stocked: z.boolean(),
  })
  .strict();

const catalogLine = z.discriminatedUnion("kind", [
  ingredientLine,
  subRecipeLine,
]);

const upsertIngredientCommand = z
  .object({
    type: z.literal(CATALOG_COMMAND.UPSERT_INGREDIENT),
    id: z.string().min(1),
    name: z.string().min(1),
    baseUnit,
    purchaseUnit: catalogUnit,
    recipeUnit: catalogUnit,
    referenceCostCop: z.number().int(),
  })
  .strict();

const upsertRecipeCommand = z
  .object({
    type: z.literal(CATALOG_COMMAND.UPSERT_RECIPE),
    id: z.string().min(1),
    name: z.string().min(1),
    productId: z.string().min(1),
    variantId: z.string().min(1).optional(),
    lines: z.array(catalogLine),
  })
  .strict();

export const recipeCatalogCommand = z
  .object({
    commands: z.array(
      z.discriminatedUnion("type", [
        upsertIngredientCommand,
        upsertRecipeCommand,
      ]),
    ),
  })
  .strict();

export type RecipeCatalogCommand = z.infer<typeof recipeCatalogCommand>;

export const recipeImportCommand = z
  .object({
    contents: z.base64(),
  })
  .strict();

export type RecipeImportCommand = z.infer<typeof recipeImportCommand>;

const importRow = z
  .object({
    row: z.number().int(),
    reason: z.string().min(1),
  })
  .strict();

export const recipeImportReport = z
  .object({
    error: z.literal("RecipeImportRejected"),
    rows: z.array(importRow),
  })
  .strict();

export type RecipeImportReport = z.infer<typeof recipeImportReport>;

export const recipeCost = z
  .object({
    costCop: z.number().int(),
    marginPercent: z.number().int(),
  })
  .strict();

export type RecipeCost = z.infer<typeof recipeCost>;

const storedUnit = z
  .object({
    name: z.string(),
    factor: z.number().int(),
  })
  .strict();

const publishedIngredient = z
  .object({
    id: z.string(),
    name: z.string(),
    baseUnit,
    purchaseUnit: storedUnit,
    recipeUnit: storedUnit,
    referenceCostCop: z.number().int(),
  })
  .strict();

const publishedIngredientLine = z
  .object({
    kind: z.literal(LINE_KIND.INGREDIENT),
    ingredientId: z.string(),
    netQuantity: z.number().int(),
    yieldPercent: z.number().int(),
  })
  .strict();

const publishedSubRecipeLine = z
  .object({
    kind: z.literal(LINE_KIND.RECIPE),
    recipeId: z.string(),
    netQuantity: z.number().int(),
    yieldPercent: z.number().int(),
    stocked: z.boolean(),
  })
  .strict();

const publishedRecipe = z
  .object({
    id: z.string(),
    name: z.string(),
    productId: z.string(),
    variantId: z.string().optional(),
    lines: z.array(
      z.discriminatedUnion("kind", [
        publishedIngredientLine,
        publishedSubRecipeLine,
      ]),
    ),
  })
  .strict();

const publishedModifier = z
  .object({
    id: z.string(),
    name: z.string(),
    deltas: z.array(
      z
        .object({
          ingredientId: z.string(),
          quantity: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();

export const recipePublication = z
  .object({
    tenantId: z.string(),
    brandId: z.string(),
    version: z.number().int(),
    authorId: z.string(),
    ingredients: z.array(publishedIngredient),
    recipes: z.array(publishedRecipe),
    modifiers: z.array(publishedModifier),
  })
  .strict();

export type RecipePublication = z.infer<typeof recipePublication>;

export const recipeCatalog = z
  .object({
    publications: z.array(recipePublication),
  })
  .strict();

export type RecipeCatalog = z.infer<typeof recipeCatalog>;
