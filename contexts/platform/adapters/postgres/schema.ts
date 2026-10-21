import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { OrganizationSnapshot } from "#application/ports/organization-repository.js";

export const venueOperations = pgTable("venue_operations", {
  venueId: text("venue_id").primaryKey(),
  mode: text("mode").notNull(),
  operationOwner: text("operation_owner").notNull(),
  generation: integer("generation").notNull(),
});

export const operationalWrites = pgTable("operational_writes", {
  writeId: text("write_id").primaryKey(),
  venueId: text("venue_id").notNull(),
  generation: integer("generation").notNull(),
});

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
});

export const taxpayers = pgTable(
  "taxpayers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    nit: text("nit").notNull(),
    taxProfileId: text("tax_profile_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    unique("taxpayers_company_id_nit").on(table.companyId, table.nit),
  ],
);

export const brands = pgTable("brands", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const venues = pgTable("venues", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  brandId: text("brand_id").notNull(),
  invoicingTaxpayerId: text("invoicing_taxpayer_id").notNull(),
  mode: text("mode").notNull(),
  position: integer("position").notNull(),
});

export const inventoryLocations = pgTable(
  "inventory_locations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    venueId: text("venue_id"),
    position: integer("position").notNull(),
  },
  (table) => [
    uniqueIndex("inventory_locations_one_point_per_venue")
      .on(table.venueId)
      .where(sql`${table.kind} = 'point'`),
  ],
);

export const kitchenStations = pgTable("kitchen_stations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  venueId: text("venue_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const cashRegisters = pgTable("cash_registers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  venueId: text("venue_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
});

export const organizationChanges = pgTable("organization_changes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  position: integer("position").notNull(),
  actorId: text("actor_id").notNull(),
  beforeSnapshot: jsonb("before_snapshot")
    .$type<OrganizationSnapshot>()
    .notNull(),
  afterSnapshot: jsonb("after_snapshot")
    .$type<OrganizationSnapshot>()
    .notNull(),
});
