import { InMemoryProductionRepository } from "#adapters/memory/in-memory-production-repository.js";
import { productionRepositoryContract } from "#application/ports/production-repository.contract.js";

productionRepositoryContract(() => {
  const production = new InMemoryProductionRepository();

  return {
    production,
    movements: async (tenantId) => production.productionMovements(tenantId),
    outboxCount: async (tenantId) => production.afterSales(tenantId).length,
    failOnInsert: (ordinal) => {
      production.failOnInsert(ordinal);
    },
    seedHolding: (input) => production.seedHolding(input),
  };
});
