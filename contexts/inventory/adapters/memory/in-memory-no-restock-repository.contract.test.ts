import { InMemoryNoRestockRepository } from "#adapters/memory/in-memory-no-restock-repository.js";
import { noRestockRepositoryContract } from "#application/ports/no-restock-repository.contract.js";

noRestockRepositoryContract(() => new InMemoryNoRestockRepository());
