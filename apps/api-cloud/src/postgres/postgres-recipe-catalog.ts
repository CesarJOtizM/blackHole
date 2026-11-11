import { DrizzleRecipeCatalogRepository } from "@blackhole/inventory/adapters/postgres/drizzle-recipe-catalog-repository";

type RecipeCatalogDatabase = ConstructorParameters<
  typeof DrizzleRecipeCatalogRepository
>[0];

export function postgresRecipeCatalogs(
  client: RecipeCatalogDatabase,
): DrizzleRecipeCatalogRepository {
  return new DrizzleRecipeCatalogRepository(client);
}
