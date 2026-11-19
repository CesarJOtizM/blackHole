import { InMemoryTransferRepository } from "#adapters/memory/in-memory-transfer-repository.js";
import { transferRepositoryContract } from "#application/ports/transfer-repository.contract.js";

transferRepositoryContract(() => {
  const transfers = new InMemoryTransferRepository();

  return {
    transfers,
    balance: (tenantId, locationId, ingredientId) =>
      transfers.balance(tenantId, locationId, ingredientId),
    averageCost: (tenantId, locationId, ingredientId) =>
      transfers.averageCost(tenantId, locationId, ingredientId),
    movements: (tenantId) => transfers.movements(tenantId),
    outboxCount: (tenantId) => transfers.outboxCount(tenantId),
    failOnInsert: (ordinal) => {
      transfers.failOnInsert(ordinal);
    },
    seedBalance: (tenantId, locationId, ingredientId, quantity, averageCost) =>
      transfers.seedBalance(
        tenantId,
        locationId,
        ingredientId,
        quantity,
        averageCost,
      ),
  };
});
