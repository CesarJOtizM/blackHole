import { InMemoryMenuRepository } from "#adapters/memory/in-memory-menu-repository.js";
import { menuRepositoryContract } from "#application/ports/menu-repository.contract.js";

menuRepositoryContract(() => new InMemoryMenuRepository());
