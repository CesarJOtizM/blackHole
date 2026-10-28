import type { PGlite } from "@electric-sql/pglite";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { taxRules } from "#adapters/postgres/schema.js";
import {
  type PublishedTaxRule,
  TaxRuleRepository,
} from "#application/ports/tax-rule-repository.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type TaxRuleRow = typeof taxRules.$inferSelect;

const toRule = (row: TaxRuleRow): PublishedTaxRule => {
  const rule: PublishedTaxRule = {
    tenantId: row.tenantId,
    id: row.id,
    version: row.version,
    name: row.name,
    taxClassification: row.taxClassification,
    validFrom: row.validFrom,
    taxes: row.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
    rutResponsibilities: [...row.rutResponsibilities],
  };

  if (row.regime !== null) {
    rule.regime = row.regime;
  }

  if (row.vatResponsible !== null) {
    rule.vatResponsible = row.vatResponsible;
  }

  if (row.incResponsible !== null) {
    rule.incResponsible = row.incResponsible;
  }

  if (row.franchise !== null) {
    rule.franchise = row.franchise;
  }

  if (row.channel !== null) {
    rule.channel = row.channel;
  }

  if (row.validTo !== null) {
    rule.validTo = row.validTo;
  }

  if (row.fixedCop !== null) {
    rule.fixedCop = row.fixedCop;
  }

  if (row.marker !== null) {
    rule.marker = row.marker;
  }

  return rule;
};

export class DrizzleTaxRuleRepository extends TaxRuleRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async list(tenantId: string): Promise<readonly PublishedTaxRule[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(taxRules)
        .orderBy(asc(taxRules.position));

      return rows.map(toRule);
    });
  }

  override async insert(rule: PublishedTaxRule): Promise<void> {
    await this.inTenant(rule.tenantId, async (tx) => {
      const existing = await tx
        .select({ id: taxRules.id })
        .from(taxRules)
        .where(
          and(eq(taxRules.id, rule.id), eq(taxRules.version, rule.version)),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new Error("A tax rule version already exists.");
      }

      const latest = await tx
        .select({ position: taxRules.position })
        .from(taxRules)
        .orderBy(desc(taxRules.position))
        .limit(1);

      await tx.insert(taxRules).values({
        tenantId: rule.tenantId,
        id: rule.id,
        version: rule.version,
        position: (latest[0]?.position ?? 0) + 1,
        name: rule.name,
        taxClassification: rule.taxClassification,
        regime: rule.regime ?? null,
        vatResponsible: rule.vatResponsible ?? null,
        incResponsible: rule.incResponsible ?? null,
        franchise: rule.franchise ?? null,
        channel: rule.channel ?? null,
        validFrom: rule.validFrom,
        validTo: rule.validTo ?? null,
        fixedCop: rule.fixedCop ?? null,
        marker: rule.marker ?? null,
        taxes: rule.taxes.map((tax) => ({ code: tax.code, rate: tax.rate })),
        rutResponsibilities: [...rule.rutResponsibilities],
      });
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE invoicing_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}
