import { venueOperationRepositoryContract } from "../../application/ports/venue-operation-repository.contract.js";
import { InMemoryVenueOperationRepository } from "./in-memory-venue-operation-repository.js";

venueOperationRepositoryContract(() => new InMemoryVenueOperationRepository());
