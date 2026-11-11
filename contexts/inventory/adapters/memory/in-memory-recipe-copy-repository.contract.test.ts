import { InMemoryRecipeCopyRepository } from "#adapters/memory/in-memory-recipe-copy-repository.js";
import { recipeCopyRepositoryContract } from "#application/ports/recipe-copy-repository.contract.js";

recipeCopyRepositoryContract(() => new InMemoryRecipeCopyRepository());
