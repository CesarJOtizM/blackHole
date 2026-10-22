import { InMemoryIdentityRepository } from "#adapters/memory/in-memory-identity-repository.js";
import { identityRepositoryContract } from "#application/ports/identity-repository.contract.js";

identityRepositoryContract(() => new InMemoryIdentityRepository());
