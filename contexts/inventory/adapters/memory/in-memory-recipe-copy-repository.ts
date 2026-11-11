import type { RecipePublication } from "#application/ports/recipe-catalog-repository.js";
import { RecipeCopyRepository } from "#application/ports/recipe-copy-repository.js";

const keyOf = (tenantId: string, brandId: string): string =>
  `${tenantId}\u0000${brandId}`;

export class InMemoryRecipeCopyRepository extends RecipeCopyRepository {
  private readonly copies = new Map<string, RecipePublication>();

  override async load(
    tenantId: string,
    brandId: string,
  ): Promise<RecipePublication | null> {
    return this.copies.get(keyOf(tenantId, brandId)) ?? null;
  }

  override async apply(
    publication: RecipePublication,
  ): Promise<RecipePublication> {
    const key = keyOf(publication.tenantId, publication.brandId);
    const current = this.copies.get(key);

    if (current && publication.version <= current.version) {
      return current;
    }

    this.copies.set(key, publication);
    return publication;
  }
}
