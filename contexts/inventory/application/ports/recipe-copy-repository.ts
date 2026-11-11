import type { RecipePublication } from "#application/ports/recipe-catalog-repository.js";

export type { RecipePublication };

export abstract class RecipeCopyRepository {
  abstract load(
    tenantId: string,
    brandId: string,
  ): Promise<RecipePublication | null>;

  abstract apply(publication: RecipePublication): Promise<RecipePublication>;
}
