import { InMemoryVenueOperationRepository } from "#adapters/memory/in-memory-venue-operation-repository.js";
import { venueOperationRepositoryContract } from "#application/ports/venue-operation-repository.contract.js";

venueOperationRepositoryContract(() => new InMemoryVenueOperationRepository());
