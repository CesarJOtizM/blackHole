import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { recordedTransfer } from "@blackhole/contracts";
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
import { afterAll, expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  routePermissions,
  TransfersController,
} from "#src/http/transfers.controller.js";

const tenantId = "organization_company_1";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const taxpayerId = "organization_taxpayer_1";
const pointId = "organization_point_1";
const warehouseId = "organization_warehouse_1";
const beefId = "ingredient_beef";
const adminId = "user_admin";
const waiterId = "user_waiter";
const keeperId = "user_keeper";
const sessionHeader = "x-session-id";
const openedAt = Date.parse("2026-11-15T12:00:00.000Z");
const originAverage = 12;
const dispatchedQuantity = 1000;

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

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

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

const requestBody = (transferId: string) => ({
  transferId,
  originLocationId: warehouseId,
  destinationLocationId: pointId,
  lines: [{ ingredientId: beefId, quantity: dispatchedQuantity }],
});

const dispatchBody = (actorId: string, deviceId: string) => ({
  actorId,
  deviceId,
});

const receiptBody = (receivedQuantity: number, authorizerId?: string) => ({
  lines: [{ ingredientId: beefId, receivedQuantity }],
  ...(authorizerId === undefined ? {} : { authorizerId }),
});

const requestUrl = `/tenants/${tenantId}/transfers`;

const dispatchUrl = (transferId: string): string =>
  `/tenants/${tenantId}/transfers/${transferId}/dispatch`;

const receiptUrl = (transferId: string): string =>
  `/tenants/${tenantId}/transfers/${transferId}/receipt`;

const post = (
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

const transferCount = async (client: PGlite): Promise<number> => {
  const selected = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM transfers",
  );

  return Number(selected.rows[0]?.count ?? 0);
};

const transferStatus = async (
  client: PGlite,
  transferId: string,
): Promise<string | null> => {
  const selected = await client.query<{ status: string }>(
    `SELECT status FROM transfers WHERE id = '${transferId}'`,
  );

  return selected.rows[0]?.status ?? null;
};

const openDatabase = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration("0001_recipe_catalog.sql"));
  await client.exec(migration("0002_stock_ledger.sql"));
  await client.exec(migration("0003_purchasing.sql"));
  await client.exec(migration("0004_transfers.sql"));
  await client.exec(
    `INSERT INTO stock_balances (tenant_id, location_id, ingredient_id, quantity, average_cost)
     VALUES ('${tenantId}', '${warehouseId}', '${beefId}', 5000, ${originAverage}),
            ('${tenantId}', '${pointId}', '${beefId}', 1000, 10)`,
  );
  return client;
};

const openCloud = async (transfersEnabled: boolean) => {
  const identities = new InMemoryIdentityRepository();
  const organizations = new InMemoryOrganizationRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const passwords = new FastPasswordHasher();
  const clock = new FakeClock(openedAt);
  const identity = Identity.open(tenantId);
  const people = [
    [adminId, "session_admin", "device_admin", "registration_admin"],
    [waiterId, "session_waiter", "device_waiter", "registration_waiter"],
    [keeperId, "session_keeper", "device_keeper", "registration_keeper"],
  ] as const;

  for (const [userId] of people) {
    identity.registerUser({
      id: userId,
      displayName: userId,
      passwordHash: await passwords.hash("secret"),
      pinHash: `pin-hash:${userId}`,
    });
  }

  identity.signInAdministration({
    userId: keeperId,
    passwordHash: await passwords.hash("secret"),
    factorHash: null,
    sessionId: "session_unregistered",
  });

  for (const [userId, sessionId, deviceId, registrationId] of people) {
    identity.issueRegistrationCode({
      id: registrationId,
      venueId,
      codeHash: `code-hash:${registrationId}`,
      now: openedAt,
    });
    identity.registerDevice({
      registrationId,
      codeHash: `code-hash:${registrationId}`,
      deviceId,
      userId,
      venueId,
      publicKey: `key:${deviceId}`,
      now: openedAt,
    });
    identity.startPinSession({
      userId,
      deviceId,
      pinHash: `pin-hash:${userId}`,
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
  organization.addSiteWarehouse({
    id: warehouseId,
    venueId,
    name: "Dry store",
  });
  const stored = picture(organization);
  await organizations.save(organization, {
    actorId: adminId,
    before: stored,
    after: stored,
  });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: [
      {
        id: "assignment_admin",
        userId: adminId,
        roleId: "siteAdministrator",
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
      {
        id: "assignment_keeper",
        userId: keeperId,
        roleId: "warehouseKeeper",
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

  const inventoryDatabase = transfersEnabled ? await openDatabase() : undefined;
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
    ...(transfersEnabled ? { transfersEnabled: true } : {}),
  });

  return { application, inventoryDatabase };
};

const listening = (application: NestFastifyApplication): boolean =>
  application.getHttpAdapter().getInstance().server.listening;

it("given transfers are off, when a request is posted, then the route is skipped and nothing is listening", async () => {
  const { application } = await openCloud(false);

  try {
    const response = await post(
      application,
      requestUrl,
      "session_admin",
      requestBody("transfer_off"),
    );

    expect(listening(application)).toBe(false);
    expect(response.statusCode).toBe(404);
    expect(() => application.get(TransfersController)).toThrow();
  } finally {
    await application.close();
  }
});

it("given an unregistered device, when a transfer is requested, then nothing is recorded", async () => {
  const { application, inventoryDatabase } = await openCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    const response = await post(
      application,
      requestUrl,
      "session_unregistered",
      requestBody("transfer_phone"),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "UnregisteredDevice" });
    expect(await transferCount(client)).toBe(0);
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a waiter on a registered device, when a transfer is requested, then it is denied", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    expect(routePermissions["POST transfers"]).toBe(
      "inventory.request-replenishment",
    );
    expect(application.get(TransfersController)).toBeInstanceOf(
      TransfersController,
    );

    const response = await post(
      application,
      requestUrl,
      "session_waiter",
      requestBody("transfer_waiter"),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "TransferRequestDenied" });
    expect(await transferCount(inventoryDatabase as PGlite)).toBe(0);
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a keeper without inventory.view-cost, when a transfer is dispatched, then unitCost is omitted", async () => {
  const { application } = await openCloud(true);

  try {
    expect(routePermissions["POST transfers/:transferId/dispatch"]).toBe(
      "inventory.receive-transfer",
    );

    const requested = await post(
      application,
      requestUrl,
      "session_keeper",
      requestBody("transfer_keeper"),
    );
    const dispatched = await post(
      application,
      dispatchUrl("transfer_keeper"),
      "session_keeper",
      dispatchBody(keeperId, "device_keeper"),
    );
    const shown = await post(
      application,
      requestUrl,
      "session_admin",
      requestBody("transfer_cost"),
    );
    const priced = await post(
      application,
      dispatchUrl("transfer_cost"),
      "session_admin",
      dispatchBody(adminId, "device_admin"),
    );

    expect(requested.statusCode).toBe(200);
    expect(dispatched.statusCode).toBe(200);
    expect(shown.statusCode).toBe(200);
    expect(priced.statusCode).toBe(200);
    expect(JSON.stringify(dispatched.json())).not.toContain("unitCost");
    expect(recordedTransfer.parse(priced.json()).lines[0]?.unitCost).toBe(
      originAverage,
    );
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a request that names an unknown field, when it is posted, then the response is 400", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    const response = await post(application, requestUrl, "session_admin", {
      ...requestBody("transfer_invalid"),
      vat: 19,
    });

    expect(response.statusCode).toBe(400);
    expect(await transferCount(inventoryDatabase as PGlite)).toBe(0);
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a keeper and a short receipt without an authorizer, when it is posted, then nothing is received", async () => {
  const { application, inventoryDatabase } = await openCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    expect(routePermissions["POST transfers/:transferId/receipt"]).toBe(
      "inventory.receive-transfer",
    );

    const requested = await post(
      application,
      requestUrl,
      "session_keeper",
      requestBody("transfer_short"),
    );
    const dispatched = await post(
      application,
      dispatchUrl("transfer_short"),
      "session_keeper",
      dispatchBody(keeperId, "device_keeper"),
    );
    const response = await post(
      application,
      receiptUrl("transfer_short"),
      "session_keeper",
      receiptBody(900),
    );

    expect(requested.statusCode).toBe(200);
    expect(dispatched.statusCode).toBe(200);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "UnauthorizedTransferDifference",
    });
    expect(await transferStatus(client, "transfer_short")).toBe("in_transit");
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a keeper and an authorizer, when a short receipt is posted, then unitCost stays hidden", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    const requested = await post(
      application,
      requestUrl,
      "session_keeper",
      requestBody("transfer_authorized"),
    );
    const dispatched = await post(
      application,
      dispatchUrl("transfer_authorized"),
      "session_keeper",
      dispatchBody(keeperId, "device_keeper"),
    );
    const response = await post(
      application,
      receiptUrl("transfer_authorized"),
      "session_keeper",
      receiptBody(900, adminId),
    );

    expect(requested.statusCode).toBe(200);
    expect(dispatched.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
    expect(JSON.stringify(response.json())).not.toContain("unitCost");
    expect(recordedTransfer.parse(response.json())).toMatchObject({
      transferId: "transfer_authorized",
      status: "received_with_differences",
    });
    expect(
      await transferStatus(inventoryDatabase as PGlite, "transfer_authorized"),
    ).toBe("received_with_differences");
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a site administrator, when a short receipt has no authorizer, then the difference is accepted", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    const requested = await post(
      application,
      requestUrl,
      "session_admin",
      requestBody("transfer_yes"),
    );
    const dispatched = await post(
      application,
      dispatchUrl("transfer_yes"),
      "session_admin",
      dispatchBody(adminId, "device_admin"),
    );
    const response = await post(
      application,
      receiptUrl("transfer_yes"),
      "session_admin",
      receiptBody(900),
    );

    expect(requested.statusCode).toBe(200);
    expect(dispatched.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
    expect(recordedTransfer.parse(response.json()).lines[0]?.unitCost).toBe(
      originAverage,
    );
    expect(
      await transferStatus(inventoryDatabase as PGlite, "transfer_yes"),
    ).toBe("received_with_differences");
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});
