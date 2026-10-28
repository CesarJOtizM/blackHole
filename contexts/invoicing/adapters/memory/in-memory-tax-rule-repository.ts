import {
  type PublishedTaxRule,
  TaxRuleRepository,
} from "#application/ports/tax-rule-repository.js";

const clone = (rule: PublishedTaxRule): PublishedTaxRule => ({
  ...rule,
  taxes: rule.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
  rutResponsibilities: [...rule.rutResponsibilities],
});

const sameVersion = (
  left: PublishedTaxRule,
  right: PublishedTaxRule,
): boolean =>
  left.tenantId === right.tenantId &&
  left.id === right.id &&
  left.version === right.version;

export class InMemoryTaxRuleRepository extends TaxRuleRepository {
  private readonly rows: PublishedTaxRule[] = [];

  override async list(tenantId: string): Promise<readonly PublishedTaxRule[]> {
    return this.rows.filter((row) => row.tenantId === tenantId).map(clone);
  }

  override async insert(rule: PublishedTaxRule): Promise<void> {
    if (this.rows.some((row) => sameVersion(row, rule))) {
      throw new Error("A tax rule version already exists.");
    }

    this.rows.push(clone(rule));
  }
}
