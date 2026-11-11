import type {
  IngredientView,
  ModifierView,
  RecipeCatalog,
  RecipeView,
} from "#domain/recipe-catalog.js";

export interface RecipePublication {
  tenantId: string;
  brandId: string;
  version: number;
  authorId: string;
  ingredients: readonly IngredientView[];
  recipes: readonly RecipeView[];
  modifiers: readonly ModifierView[];
}

export abstract class RecipeCatalogRepository {
  abstract load(
    tenantId: string,
    brandId: string,
  ): Promise<RecipeCatalog | null>;

  abstract save(
    catalog: RecipeCatalog,
    publication: RecipePublication,
  ): Promise<void>;

  abstract listPublications(
    tenantId: string,
    brandId: string,
  ): Promise<readonly RecipePublication[]>;
}
