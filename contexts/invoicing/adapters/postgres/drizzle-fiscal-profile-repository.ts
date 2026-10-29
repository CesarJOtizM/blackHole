import type { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  adoptedFiscalProfiles,
  fiscalTemplates,
} from "#adapters/postgres/schema.js";
import {
  type AdoptedFiscalProfile,
  type CopiedFiscalRule,
  type FiscalProfileFields,
  FiscalProfileRepository,
  type FiscalTemplate,
  type FiscalTemplateRule,
} from "#application/ports/fiscal-profile-repository.js";
import type { TaxComponent } from "#domain/calculate-taxes.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const copyTaxes = (taxes: readonly TaxComponent[]): TaxComponent[] =>
  taxes.map((tax) => ({ code: tax.code, rate: tax.rate }));

const copyFields = (profile: FiscalProfileFields): FiscalProfileFields => ({
  personType: profile.personType,
  regime: profile.regime,
  vatResponsible: profile.vatResponsible,
  incResponsible: profile.incResponsible,
  franchise: profile.franchise,
  rutResponsibilities: [...profile.rutResponsibilities],
  municipalities: profile.municipalities.map((site) => ({
    siteId: site.siteId,
    municipality: site.municipality,
  })),
});

const copyTemplateRule = (rule: FiscalTemplateRule): FiscalTemplateRule => {
  const copy: FiscalTemplateRule = {
    rowId: rule.rowId,
    id: rule.id,
    version: rule.version,
    name: rule.name,
    taxClassification: rule.taxClassification,
    validFrom: rule.validFrom,
    taxes: copyTaxes(rule.taxes),
    rutResponsibilities: [...rule.rutResponsibilities],
  };

  if (rule.regime !== undefined) {
    copy.regime = rule.regime;
  }

  if (rule.vatResponsible !== undefined) {
    copy.vatResponsible = rule.vatResponsible;
  }

  if (rule.incResponsible !== undefined) {
    copy.incResponsible = rule.incResponsible;
  }

  if (rule.franchise !== undefined) {
    copy.franchise = rule.franchise;
  }

  if (rule.channel !== undefined) {
    copy.channel = rule.channel;
  }

  if (rule.validTo !== undefined) {
    copy.validTo = rule.validTo;
  }

  if (rule.fixedCop !== undefined) {
    copy.fixedCop = rule.fixedCop;
  }

  if (rule.marker !== undefined) {
    copy.marker = rule.marker;
  }

  return copy;
};

const copyCopiedRule = (rule: CopiedFiscalRule): CopiedFiscalRule => ({
  ...copyTemplateRule(rule),
  templateRowId: rule.templateRowId,
});

const toTemplate = (row: {
  id: string;
  name: string;
  profile: FiscalProfileFields;
  rules: readonly FiscalTemplateRule[];
}): FiscalTemplate => ({
  id: row.id,
  name: row.name,
  profile: copyFields(row.profile),
  rules: row.rules.map(copyTemplateRule),
});

const toAdopted = (row: {
  tenantId: string;
  taxpayerId: string;
  id: string;
  templateId: string;
  profile: FiscalProfileFields;
  rules: readonly CopiedFiscalRule[];
}): AdoptedFiscalProfile => ({
  tenantId: row.tenantId,
  taxpayerId: row.taxpayerId,
  id: row.id,
  templateId: row.templateId,
  profile: copyFields(row.profile),
  rules: row.rules.map(copyCopiedRule),
});

export class DrizzleFiscalProfileRepository extends FiscalProfileRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async insertTemplate(template: FiscalTemplate): Promise<void> {
    await this.asCatalog(async (tx) => {
      const existing = await tx
        .select({ id: fiscalTemplates.id, name: fiscalTemplates.name })
        .from(fiscalTemplates);

      if (
        existing.some(
          (row) => row.id === template.id || row.name === template.name,
        )
      ) {
        throw new Error("A fiscal template already exists.");
      }

      await tx.insert(fiscalTemplates).values({
        id: template.id,
        name: template.name,
        profile: copyFields(template.profile),
        rules: template.rules.map(copyTemplateRule),
      });
    });
  }

  override async findTemplate(
    name: string,
  ): Promise<FiscalTemplate | undefined> {
    return this.asCatalog(async (tx) => {
      const rows = await tx
        .select()
        .from(fiscalTemplates)
        .where(eq(fiscalTemplates.name, name))
        .limit(1);
      const row = rows[0];

      return row === undefined ? undefined : toTemplate(row);
    });
  }

  override async findAdopted(
    tenantId: string,
    profileId: string,
  ): Promise<AdoptedFiscalProfile | undefined> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(adoptedFiscalProfiles)
        .where(eq(adoptedFiscalProfiles.id, profileId))
        .limit(1);
      const row = rows[0];

      return row === undefined ? undefined : toAdopted(row);
    });
  }

  override async insertAdopted(profile: AdoptedFiscalProfile): Promise<void> {
    await this.inTenant(profile.tenantId, async (tx) => {
      if (await this.replacesTemplate(tx, profile.id)) {
        throw new Error("A copy cannot replace the template row.");
      }

      const duplicate = await tx
        .select({ id: adoptedFiscalProfiles.id })
        .from(adoptedFiscalProfiles)
        .where(eq(adoptedFiscalProfiles.id, profile.id))
        .limit(1);

      if (duplicate.length > 0) {
        throw new Error("An adopted fiscal profile already exists.");
      }

      await tx.insert(adoptedFiscalProfiles).values({
        tenantId: profile.tenantId,
        id: profile.id,
        taxpayerId: profile.taxpayerId,
        templateId: profile.templateId,
        profile: copyFields(profile.profile),
        rules: profile.rules.map(copyCopiedRule),
      });
    });
  }

  override async saveAdopted(profile: AdoptedFiscalProfile): Promise<void> {
    await this.inTenant(profile.tenantId, async (tx) => {
      if (await this.replacesTemplate(tx, profile.id)) {
        throw new Error("A copy cannot replace the template row.");
      }

      const current = await tx
        .select({ id: adoptedFiscalProfiles.id })
        .from(adoptedFiscalProfiles)
        .where(eq(adoptedFiscalProfiles.taxpayerId, profile.taxpayerId))
        .limit(1);
      const stored = current[0];

      if (stored === undefined) {
        throw new Error("A copy cannot replace the template row.");
      }

      await tx
        .update(adoptedFiscalProfiles)
        .set({
          id: profile.id,
          taxpayerId: profile.taxpayerId,
          templateId: profile.templateId,
          profile: copyFields(profile.profile),
          rules: profile.rules.map(copyCopiedRule),
        })
        .where(eq(adoptedFiscalProfiles.id, stored.id));
    });
  }

  private async replacesTemplate(
    tx: Transaction,
    profileId: string,
  ): Promise<boolean> {
    const rows = await tx
      .select({ id: fiscalTemplates.id })
      .from(fiscalTemplates)
      .where(eq(fiscalTemplates.id, profileId))
      .limit(1);

    return rows.length > 0;
  }

  private async asCatalog<T>(
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE invoicing_app`);

      return work(tx);
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
