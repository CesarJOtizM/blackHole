import {
  RecipeCatalogRepository,
  type RecipePublication,
} from "#application/ports/recipe-catalog-repository.js";
import type { RecipeCatalog } from "#domain/recipe-catalog.js";

const keyOf = (tenantId: string, brandId: string): string =>
  `${tenantId}\u0000${brandId}`;

export class InMemoryRecipeCatalogRepository extends RecipeCatalogRepository {
  private readonly catalogs = new Map<string, RecipeCatalog>();
  private readonly rows = new Map<string, RecipePublication[]>();

  override async load(
    tenantId: string,
    brandId: string,
  ): Promise<RecipeCatalog | null> {
    return this.catalogs.get(keyOf(tenantId, brandId)) ?? null;
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

    const key = keyOf(catalog.tenantId, catalog.brandId);
    const existing = this.rows.get(key) ?? [];

    if (existing.some((row) => row.version === publication.version)) {
      throw new Error("That publication version was already stored.");
    }

    this.catalogs.set(key, catalog);
    this.rows.set(key, [...existing, publication]);
  }

  override async listPublications(
    tenantId: string,
    brandId: string,
  ): Promise<readonly RecipePublication[]> {
    return [...(this.rows.get(keyOf(tenantId, brandId)) ?? [])];
  }
}
