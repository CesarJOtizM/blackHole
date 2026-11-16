import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import type { OrganizationSnapshot } from "@blackhole/platform/application/ports/organization-repository";
import {
  Authorization,
  Identity,
  Organization,
} from "@blackhole/platform/domain";
import { PGlite } from "@electric-sql/pglite";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";

export const tenantId = "organization_company_1";
export const brandId = "organization_brand_1";
export const venueId = "organization_venue_1";
export const taxpayerId = "organization_taxpayer_1";
export const pointId = "organization_point_1";
export const alertId = "alert_beef";
export const ownerId = "user_owner";
export const chiefId = "user_kitchen_chief";
export const waiterId = "user_waiter";
export const sessionHeader = "x-session-id";
export const chiefSession = "session_chief";
export const waiterSession = "session_waiter";
export const openedAt = Date.parse("2026-11-15T20:00:00.000Z");
export const notifiedAt = "2026-11-15T20:00:00.000Z";

export const restockUrl = `/tenants/${tenantId}/venues/${venueId}/shortage-alerts/${alertId}/restock`;
export const levelsUrl = `/tenants/${tenantId}/venues/${venueId}/stock-levels`;
export const seenUrl = `/tenants/${tenantId}/venues/${venueId}/shortage-alerts/${alertId}/seen`;
export const realtimeUrl = `/tenants/${tenantId}/venues/${venueId}/shortage-realtime`;

export const kitchenNotice = {
  alertId,
  kind: "level",
  severity: "red",
  role: "siteAdministrator",
  venueId,
} as const;

const clients: PGlite[] = [];

export const closeShortageDatabases = async (): Promise<void> => {
  await Promise.all(clients.map((client) => client.close()));
  clients.length = 0;
};

const migration = (name: string): string =>
  readFileSync(
    fileURLToPath(
      new URL(
        `../../../../contexts/inventory/adapters/postgres/${name}`,
        import.meta.url,
      ),
    ),
    "utf8",
  );

const picture = (organization: Organization): OrganizationSnapshot => ({
  id: organization.id,
  name: organization.name,
  taxpayers: organization.taxpayers,
  brands: organization.brands,
  venues: organization.venues,
  locations: organization.locations,
  kitchenStations: organization.kitchenStations,
  cashRegisters: organization.cashRegisters,
});

export const restockBody = (documentId: string) => ({
  purchaseUnit: 1,
  documentId,
  lineId: `line_${documentId}`,
  warehouseId: null,
  supplierId: null,
});

export const postJson = (
  application: NestFastifyApplication,
  url: string,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

export const listening = (application: NestFastifyApplication): boolean =>
  application.getHttpAdapter().getInstance().server.listening;

const openDatabase = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration("0001_recipe_catalog.sql"));
  await client.exec(migration("0009_shortage_alerts.sql"));
  return client;
};

export const seedKitchenNotice = async (client: PGlite): Promise<void> => {
  await client.query(
    `INSERT INTO shortage_alerts (
      tenant_id, id, venue_id, kind, status, opened_at,
      brand_id, location_id, ingredient_id, severity, sold_out
    ) VALUES ($1, $2, $3, 'level', 'open', $4, $5, $6, 'ingredient_beef', 'red', false)`,
    [tenantId, alertId, venueId, notifiedAt, brandId, pointId],
  );
  await client.query(
    `INSERT INTO role_notices (
      tenant_id, id, venue_id, alert_id, role, kind, severity, notified_at
    ) VALUES
      ($1, 'notice_beef_admin', $2, $3, 'siteAdministrator', 'level', 'red', $4),
      ($1, 'notice_beef_kitchen', $2, $3, 'kitchenChief', 'level', 'red', $4)`,
    [tenantId, venueId, alertId, notifiedAt],
  );
};

export const openShortageCloud = async (shortageAlertsEnabled: boolean) => {
  const identities = new InMemoryIdentityRepository();
  const organizations = new InMemoryOrganizationRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const passwords = new FastPasswordHasher();
  const clock = new FakeClock(openedAt);
  const identity = Identity.open(tenantId);
  const people = [
    [ownerId, "session_owner"],
    [chiefId, chiefSession],
    [waiterId, waiterSession],
  ] as const;

  for (const [userId, sessionId] of people) {
    identity.registerUser({
      id: userId,
      displayName: userId,
      passwordHash: await passwords.hash("secret"),
      pinHash: `pin-hash:${userId}`,
    });
    identity.signInAdministration({
      userId,
      passwordHash: await passwords.hash("secret"),
      factorHash: null,
      sessionId,
    });
  }

  const signedIn = identity.snapshot();
  await identities.save(identity, { before: signedIn, after: signedIn });

  const organization = Organization.registerCompany({
    id: tenantId,
    name: "Pilot",
  });
  organization.addTaxpayer({
    id: taxpayerId,
    nit: "900123",
    taxProfileId: "organization_tax_1",
  });
  organization.addBrand({ id: brandId, name: "Brand" });
  organization.openVenue({
    id: venueId,
    name: "Site one",
    brandId,
    taxpayerId,
    pointId,
  });
  const stored = picture(organization);
  await organizations.save(organization, {
    actorId: ownerId,
    before: stored,
    after: stored,
  });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: [
      {
        id: "assignment_owner",
        userId: ownerId,
        roleId: "owner",
        scopeKind: "company",
        scopeId: tenantId,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_chief",
        userId: chiefId,
        roleId: "kitchenChief",
        scopeKind: "site",
        scopeId: venueId,
        validFrom: null,
        validUntil: null,
      },
      {
        id: "assignment_waiter",
        userId: waiterId,
        roleId: "waiter",
        scopeKind: "site",
        scopeId: venueId,
        validFrom: null,
        validUntil: null,
      },
    ],
    venueLimits: [],
    bartenderCharge: [],
    requests: [],
    resolutions: [],
    supportGrants: [],
    supportActions: [],
    shiftFlags: [],
    notices: [],
  });
  await authorizations.save(authorization, {
    before: Authorization.open(tenantId).snapshot(),
    after: authorization.snapshot(),
  });

  const inventoryDatabase = shortageAlertsEnabled
    ? await openDatabase()
    : undefined;
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations,
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    authorizations,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
    ...(inventoryDatabase ? { inventoryDatabase } : {}),
    ...(shortageAlertsEnabled ? { shortageAlertsEnabled: true } : {}),
  });

  return { application, inventoryDatabase };
};
