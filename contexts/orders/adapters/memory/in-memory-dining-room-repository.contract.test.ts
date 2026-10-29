import { InMemoryDiningRoomRepository } from "#adapters/memory/in-memory-dining-room-repository.js";
import { diningRoomRepositoryContract } from "#application/ports/dining-room-repository.contract.js";

diningRoomRepositoryContract(() => new InMemoryDiningRoomRepository());
