import type { BaseUnit } from "#domain/recipe-catalog.js";

export const WORKBOOK_LINE_KIND = {
  INGREDIENT: "ingredient",
  RECIPE: "recipe",
} as const;

export interface WorkbookUnit {
  name: string;
  baseQuantity: number;
}

export interface WorkbookIngredient {
  row: number;
  id: string;
  name: string;
  baseUnit: BaseUnit;
  purchaseUnit: WorkbookUnit;
  recipeUnit: WorkbookUnit;
  referenceCostCop: number;
}

interface WorkbookRecipeIdentity {
  row: number;
  recipeId: string;
  recipeName: string;
  productId: string;
  variantId?: string;
  netQuantity: number;
  yieldPercent: number;
}

export interface WorkbookIngredientLine extends WorkbookRecipeIdentity {
  kind: typeof WORKBOOK_LINE_KIND.INGREDIENT;
  ingredientId: string;
}

export interface WorkbookSubRecipeLine extends WorkbookRecipeIdentity {
  kind: typeof WORKBOOK_LINE_KIND.RECIPE;
  subRecipeId: string;
  stocked: boolean;
}

export type WorkbookLine = WorkbookIngredientLine | WorkbookSubRecipeLine;

export interface RecipeWorkbookSheet {
  ingredients: readonly WorkbookIngredient[];
  lines: readonly WorkbookLine[];
}

export abstract class RecipeWorkbook {
  abstract read(contents: Uint8Array): Promise<RecipeWorkbookSheet>;
}
