import { InMemoryFiscalProfileRepository } from "#adapters/memory/in-memory-fiscal-profile-repository.js";
import { fiscalProfileRepositoryContract } from "#application/ports/fiscal-profile-repository.contract.js";

fiscalProfileRepositoryContract(() => new InMemoryFiscalProfileRepository());
