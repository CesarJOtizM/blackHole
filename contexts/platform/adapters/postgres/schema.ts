import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { OrganizationSnapshot } from "#application/ports/organization-repository.js";
import type { AuthorizationSnapshot } from "#application/ports/authorization-repository.js";
import type { IdentitySnapshot } from "#domain/identity.js";

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

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  pinHash: text("pin_hash").notNull(),
  factorHash: text("factor_hash"),
  failedFactorAttempts: integer("failed_factor_attempts").notNull(),
  active: boolean("active").notNull(),
  position: integer("position").notNull(),
});

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  venueId: text("venue_id").notNull(),
  kind: text("kind").notNull(),
  stationId: text("station_id"),
  publicKey: text("public_key").notNull(),
  displayName: text("display_name").notNull(),
  pinFailures: integer("pin_failures").notNull(),
  pinAttemptsLocked: boolean("pin_attempts_locked").notNull(),
  revoked: boolean("revoked").notNull(),
  position: integer("position").notNull(),
});

export const registrationCodes = pgTable("registration_codes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  venueId: text("venue_id").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  failedRedeems: integer("failed_redeems").notNull(),
  locked: boolean("locked").notNull(),
  used: boolean("used").notNull(),
  position: integer("position").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  userId: text("user_id").notNull(),
  displayName: text("display_name").notNull(),
  deviceId: text("device_id").notNull(),
  venueId: text("venue_id").notNull(),
  kind: text("kind").notNull(),
  position: integer("position").notNull(),
});

export const identityChanges = pgTable("identity_changes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  position: integer("position").notNull(),
  beforeSnapshot: jsonb("before_snapshot").$type<IdentitySnapshot>().notNull(),
  afterSnapshot: jsonb("after_snapshot").$type<IdentitySnapshot>().notNull(),
});

export const authorizations = pgTable("authorizations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
});

export const authorizationRoles = pgTable("authorization_roles", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  sourceRoleId: text("source_role_id").notNull(),
  position: integer("position").notNull(),
});

export const authorizationRolePermissions = pgTable(
  "authorization_role_permissions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    roleId: text("role_id").notNull(),
    permission: text("permission").notNull(),
    grantValue: text("grant_value").notNull(),
    position: integer("position").notNull(),
  },
);

export const authorizationRoleLimits = pgTable("authorization_role_limits", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  roleId: text("role_id").notNull(),
  limitCode: text("limit_code").notNull(),
  cap: integer("cap").notNull(),
  position: integer("position").notNull(),
});

export const authorizationAssignments = pgTable("authorization_assignments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  scopeKind: text("scope_kind").notNull(),
  scopeId: text("scope_id").notNull(),
  validFrom: bigint("valid_from", { mode: "number" }),
  validUntil: bigint("valid_until", { mode: "number" }),
  position: integer("position").notNull(),
});

export const authorizationVenueLimits = pgTable("authorization_venue_limits", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  venueId: text("venue_id").notNull(),
  roleId: text("role_id").notNull(),
  limitCode: text("limit_code").notNull(),
  cap: integer("cap").notNull(),
  position: integer("position").notNull(),
});

export const authorizationBartenderFlags = pgTable(
  "authorization_bartender_flags",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    enabled: boolean("enabled").notNull(),
    position: integer("position").notNull(),
  },
);

export const authorizationRequests = pgTable("authorization_requests", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  requesterId: text("requester_id").notNull(),
  permission: text("permission").notNull(),
  venueId: text("venue_id").notNull(),
  value: integer("value"),
  reason: text("reason").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  status: text("status").notNull(),
  position: integer("position").notNull(),
});

export const authorizationResolutions = pgTable("authorization_resolutions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  requestId: text("request_id").notNull(),
  requesterId: text("requester_id").notNull(),
  authorizerId: text("authorizer_id").notNull(),
  action: text("action").notNull(),
  value: integer("value"),
  reason: text("reason").notNull(),
  deviceId: text("device_id").notNull(),
  occurredAt: bigint("occurred_at", { mode: "number" }).notNull(),
  selfAuthorized: boolean("self_authorized").notNull(),
  approved: boolean("approved").notNull(),
  position: integer("position").notNull(),
});

export const authorizationSupportGrants = pgTable(
  "authorization_support_grants",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    actorId: text("actor_id").notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    expired: boolean("expired").notNull(),
    revoked: boolean("revoked").notNull(),
    position: integer("position").notNull(),
  },
);

export const authorizationSupportActions = pgTable(
  "authorization_support_actions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    grantId: text("grant_id").notNull(),
    actorId: text("actor_id").notNull(),
    permission: text("permission").notNull(),
    occurredAt: bigint("occurred_at", { mode: "number" }).notNull(),
    position: integer("position").notNull(),
  },
);

export const authorizationShiftFlags = pgTable("authorization_shift_flags", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  venueId: text("venue_id").notNull(),
  shiftId: text("shift_id").notNull(),
  selfAuthorization: boolean("self_authorization").notNull(),
  position: integer("position").notNull(),
});

export const authorizationNotices = pgTable("authorization_notices", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  kind: text("kind").notNull(),
  occurredAt: bigint("occurred_at", { mode: "number" }).notNull(),
  position: integer("position").notNull(),
});

export const authorizationChanges = pgTable("authorization_changes", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  position: integer("position").notNull(),
  beforeSnapshot: jsonb("before_snapshot")
    .$type<AuthorizationSnapshot>()
    .notNull(),
  afterSnapshot: jsonb("after_snapshot")
    .$type<AuthorizationSnapshot>()
    .notNull(),
});
