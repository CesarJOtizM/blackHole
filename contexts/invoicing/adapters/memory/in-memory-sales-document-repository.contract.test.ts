import {
  InMemorySalesDocumentRepository,
  SalesDocumentMemory,
} from "#adapters/memory/in-memory-sales-document-repository.js";
import { salesDocumentRepositoryContract } from "#application/ports/sales-document-repository.contract.js";

salesDocumentRepositoryContract(() => {
  const memory = new SalesDocumentMemory();

  return {
    forTenant: (tenantId) =>
      new InMemorySalesDocumentRepository(tenantId, memory),
  };
});
