import { InMemoryCashRegisterRepository } from "#adapters/memory/in-memory-cash-register-repository.js";
import { cashRegisterRepositoryContract } from "#application/ports/cash-register-repository.contract.js";

cashRegisterRepositoryContract(() => new InMemoryCashRegisterRepository());
