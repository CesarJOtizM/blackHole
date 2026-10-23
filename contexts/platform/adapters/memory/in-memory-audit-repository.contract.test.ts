import { InMemoryAuditRepository } from "#adapters/memory/in-memory-audit-repository.js";
import { auditRepositoryContract } from "#application/ports/audit-repository.contract.js";

auditRepositoryContract(() => new InMemoryAuditRepository());
