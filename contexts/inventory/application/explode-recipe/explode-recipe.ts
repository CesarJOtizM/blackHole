import type { RecipeCatalogRepository } from "#application/ports/recipe-catalog-repository.js";
import {
  type ExplodedQuantity,
  UnknownRecipe,
} from "#domain/recipe-catalog.js";

export interface ExplodeRecipeInput {
  tenantId: string;
  brandId: string;
  productId: string;
  variantId?: string;
  version?: number;
  modifierIds?: readonly string[];
}

export class ExplodeRecipe {
  constructor(private readonly catalogs: RecipeCatalogRepository) {}

  async execute(
    input: ExplodeRecipeInput,
  ): Promise<readonly ExplodedQuantity[]> {
    const catalog = await this.catalogs.load(input.tenantId, input.brandId);

    if (catalog === null) {
      throw new UnknownRecipe();
    }

    return catalog.explode({
      productId: input.productId,
      ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
      ...(input.version === undefined ? {} : { version: input.version }),
      ...(input.modifierIds === undefined
        ? {}
        : { modifierIds: input.modifierIds }),
    });
  }
}
