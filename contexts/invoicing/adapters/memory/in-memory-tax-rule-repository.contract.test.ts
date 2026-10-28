import { InMemoryTaxRuleRepository } from "#adapters/memory/in-memory-tax-rule-repository.js";
import { taxRuleRepositoryContract } from "#application/ports/tax-rule-repository.contract.js";

taxRuleRepositoryContract(() => new InMemoryTaxRuleRepository());
