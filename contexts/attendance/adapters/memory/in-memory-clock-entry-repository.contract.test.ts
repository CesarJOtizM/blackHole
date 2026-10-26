import { InMemoryClockEntryRepository } from "#adapters/memory/in-memory-clock-entry-repository.js";
import { clockEntryRepositoryContract } from "#application/ports/clock-entry-repository.contract.js";

clockEntryRepositoryContract(() => new InMemoryClockEntryRepository());
