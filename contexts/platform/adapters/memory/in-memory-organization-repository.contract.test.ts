import { InMemoryOrganizationRepository } from "#adapters/memory/in-memory-organization-repository.js";
import { organizationRepositoryContract } from "#application/ports/organization-repository.contract.js";

organizationRepositoryContract(() => new InMemoryOrganizationRepository());
