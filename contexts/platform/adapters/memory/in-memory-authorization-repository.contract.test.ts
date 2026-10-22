import { InMemoryAuthorizationRepository } from "#adapters/memory/in-memory-authorization-repository.js";
import { authorizationRepositoryContract } from "#application/ports/authorization-repository.contract.js";

authorizationRepositoryContract(() => new InMemoryAuthorizationRepository());
