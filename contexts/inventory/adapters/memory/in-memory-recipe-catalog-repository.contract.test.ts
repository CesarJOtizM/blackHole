import { InMemoryRecipeCatalogRepository } from "#adapters/memory/in-memory-recipe-catalog-repository.js";
import { recipeCatalogRepositoryContract } from "#application/ports/recipe-catalog-repository.contract.js";

recipeCatalogRepositoryContract(() => new InMemoryRecipeCatalogRepository());
