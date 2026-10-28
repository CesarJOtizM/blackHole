import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core";
import type {
  CopiedFiscalRule,
  FiscalProfileFields,
  FiscalTemplateRule,
} from "#application/ports/fiscal-profile-repository.js";
import type { TaxMarker } from "#application/ports/tax-rule-repository.js";
import type {
  TaxChannel,
  TaxComponent,
  TaxRegime,
} from "#domain/calculate-taxes.js";

export const taxRules = pgTable(
  "tax_rules",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    version: integer("version").notNull(),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    taxClassification: text("tax_classification").notNull(),
    regime: text("regime").$type<TaxRegime | null>(),
    vatResponsible: boolean("vat_responsible"),
    incResponsible: boolean("inc_responsible"),
    franchise: boolean("franchise"),
    channel: text("channel").$type<TaxChannel | null>(),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
    fixedCop: integer("fixed_cop"),
    marker: text("marker").$type<TaxMarker | null>(),
    taxes: jsonb("taxes").$type<TaxComponent[]>().notNull(),
    rutResponsibilities: jsonb("rut_responsibilities")
      .$type<string[]>()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id, table.version] }),
    unique("tax_rules_position").on(table.tenantId, table.position),
  ],
);

export const fiscalTemplates = pgTable("fiscal_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  profile: jsonb("profile").$type<FiscalProfileFields>().notNull(),
  rules: jsonb("rules").$type<FiscalTemplateRule[]>().notNull(),
});

export const adoptedFiscalProfiles = pgTable(
  "adopted_fiscal_profiles",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    taxpayerId: text("taxpayer_id").notNull(),
    templateId: text("template_id").notNull(),
    profile: jsonb("profile").$type<FiscalProfileFields>().notNull(),
    rules: jsonb("rules").$type<CopiedFiscalRule[]>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);
