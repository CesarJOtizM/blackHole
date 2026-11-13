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
import type { OneTimeCodeChannel } from "#application/ports/one-time-code-sender.js";
import type { PortalReinvoiceRequestStatus } from "#application/ports/portal-repository.js";
import type { DocumentHoldReason } from "#application/ports/sales-document-repository.js";
import type { TaxMarker } from "#application/ports/tax-rule-repository.js";
import type { InvoiceSnapshot } from "#domain/billing-data.js";
import type {
  TaxChannel,
  TaxComponent,
  TaxRegime,
} from "#domain/calculate-taxes.js";
import type { DocumentContent } from "#domain/document-content.js";
import type { ReinvoiceWindowMode } from "#domain/reinvoice-window.js";
import type {
  GenericBuyer,
  SalesDocumentStatus,
} from "#domain/sales-document.js";

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

export const salesDocuments = pgTable(
  "sales_documents",
  {
    tenantId: text("tenant_id").notNull(),
    closureId: text("closure_id").notNull(),
    referenceCode: text("reference_code").notNull(),
    status: text("status").$type<SalesDocumentStatus>().notNull(),
    holdReason: text("hold_reason").$type<DocumentHoldReason | null>(),
    buyer: jsonb("buyer").$type<GenericBuyer>().notNull(),
    content: jsonb("content").$type<DocumentContent>().notNull(),
    invoiceNumber: text("invoice_number"),
    cufe: text("cufe"),
    qr: text("qr"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.closureId] }),
    unique("sales_documents_reference").on(table.tenantId, table.referenceCode),
  ],
);

export const rememberedBuyers = pgTable(
  "remembered_buyers",
  {
    tenantId: text("tenant_id").notNull(),
    documentType: text("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    channel: text("channel").$type<OneTimeCodeChannel>().notNull(),
    destination: text("destination").notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.documentType, table.documentNumber],
    }),
  ],
);

export const consents = pgTable(
  "consents",
  {
    tenantId: text("tenant_id").notNull(),
    documentType: text("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    personType: text("person_type").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    municipalityCode: text("municipality_code").notNull(),
    acceptedAt: text("accepted_at"),
    policyVersion: text("policy_version"),
    policyLink: text("policy_link"),
    deletedAt: text("deleted_at"),
    invoiceSnapshots: jsonb("invoice_snapshots")
      .$type<InvoiceSnapshot[]>()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.documentType, table.documentNumber],
    }),
  ],
);

export const oneTimeCodes = pgTable(
  "one_time_codes",
  {
    tenantId: text("tenant_id").notNull(),
    documentType: text("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    digest: text("digest").notNull(),
    sentAt: text("sent_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    attemptsRemaining: integer("attempts_remaining").notNull(),
    spent: boolean("spent").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.documentType, table.documentNumber],
    }),
  ],
);

export const portalLookups = pgTable("portal_lookups", {
  lookupId: text("lookup_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  documentType: text("document_type").notNull(),
  documentNumber: text("document_number").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

export const acquirerCache = pgTable(
  "acquirer_cache",
  {
    tenantId: text("tenant_id").notNull(),
    documentType: text("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    cachedAt: text("cached_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.documentType, table.documentNumber],
    }),
  ],
);

export const portalSubmissions = pgTable(
  "portal_submissions",
  {
    tenantId: text("tenant_id").notNull(),
    checkId: text("check_id").notNull(),
    documentType: text("document_type").notNull(),
    documentNumber: text("document_number").notNull(),
    personType: text("person_type").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    municipalityCode: text("municipality_code").notNull(),
    acceptedAt: text("accepted_at").notNull(),
    policyVersion: text("policy_version").notNull(),
    policyLink: text("policy_link").notNull(),
    deletedAt: text("deleted_at"),
    invoiceSnapshots: jsonb("invoice_snapshots")
      .$type<InvoiceSnapshot[]>()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.checkId] })],
);

export const reinvoiceRequests = pgTable(
  "reinvoice_requests",
  {
    tenantId: text("tenant_id").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    issuedAt: text("issued_at").notNull(),
    requestedAt: text("requested_at").notNull(),
    status: text("status").$type<PortalReinvoiceRequestStatus>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.invoiceNumber] })],
);

export const portalSettings = pgTable("portal_settings", {
  tenantId: text("tenant_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  windowMode: text("window_mode")
    .$type<ReinvoiceWindowMode>()
    .notNull()
    .default("same_day"),
});

export const portalRateWindows = pgTable(
  "portal_rate_windows",
  {
    token: text("token").notNull(),
    ip: text("ip").notNull(),
  },
  (table) => [primaryKey({ columns: [table.token, table.ip] })],
);

export const daneMunicipalities = pgTable("dane_municipalities", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  departmentCode: text("department_code").notNull(),
  departmentName: text("department_name").notNull(),
});
