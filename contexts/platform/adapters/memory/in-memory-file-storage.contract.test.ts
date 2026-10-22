import { InMemoryFileStorage } from "#adapters/memory/in-memory-file-storage.js";
import { fileStorageContract } from "#application/ports/file-storage.contract.js";

fileStorageContract(() => new InMemoryFileStorage());
