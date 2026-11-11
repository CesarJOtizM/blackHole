import type {
  RecipeCatalogRepository,
  RecipePublication,
} from "#application/ports/recipe-catalog-repository.js";
import type { RecipeCatalog } from "#domain/recipe-catalog.js";

export const savePublishedVersion = async (
  catalogs: RecipeCatalogRepository,
  catalog: RecipeCatalog,
  authorId: string,
): Promise<RecipePublication> => {
  const version = catalog.publish({ authorId });
  const published = catalog.publishedVersion(version);
  const publication: RecipePublication = {
    tenantId: catalog.tenantId,
    brandId: catalog.brandId,
    version,
    authorId: published.authorId,
    ingredients: published.ingredients,
    recipes: published.recipes,
    modifiers: published.modifiers,
  };

  await catalogs.save(catalog, publication);
  return publication;
};
