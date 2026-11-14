import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { purchaseReceipt } from "@blackhole/contracts";
import { InMemoryRecipeCatalogRepository } from "@blackhole/inventory/adapters/memory/in-memory-recipe-catalog-repository";
import { DrizzleStockLedgerRepository } from "@blackhole/inventory/adapters/postgres/drizzle-stock-ledger-repository";
import { UpdateRecipeCatalog } from "@blackhole/inventory/application/entry-port";
import { QUANTITY_SCALE } from "@blackhole/inventory/domain";
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
import { afterAll, expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  PurchasingController,
  routePermissions,
} from "#src/http/purchasing.controller.js";

const tenantId = "organization_company_1";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const taxpayerId = "organization_taxpayer_1";
const pointId = "organization_point_1";
const warehouseId = "organization_warehouse_1";
const tomatoId = "ingredient_tomato";
const ownerId = "user_owner";
const adminId = "user_admin";
const waiterId = "user_waiter";
const keeperId = "user_keeper";
const sessionHeader = "x-session-id";
const kgFactor = 1000 * QUANTITY_SCALE;

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

const receiptBody = (
  receiptId: string,
  locationId: string,
  purchaseQuantity = 5,
) => ({
  receiptId,
  locationId,
  lines: [
    {
      ingredientId: tomatoId,
      purchaseQuantity,
      purchaseUnitCost: 4000,
    },
  ],
});

const openDatabase = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration("0001_recipe_catalog.sql"));
  await client.exec(migration("0002_stock_ledger.sql"));
  await client.exec(migration("0003_purchasing.sql"));
  return client;
};

const openCloud = async (purchasingEnabled: boolean) => {
  const identities = new InMemoryIdentityRepository();
  const organizations = new InMemoryOrganizationRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const catalogs = new InMemoryRecipeCatalogRepository();
  const passwords = new FastPasswordHasher();
  const clock = new FakeClock(0);
  const identity = Identity.open(tenantId);
  const people = [
    [ownerId, "session_owner"],
    [adminId, "session_admin"],
    [waiterId, "session_waiter"],
    [keeperId, "session_keeper"],
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
  organization.addSiteWarehouse({
    id: warehouseId,
    venueId,
    name: "Dry store",
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
  await new UpdateRecipeCatalog(catalogs).execute({
    tenantId,
    brandId,
    authorId: ownerId,
    commands: [
      {
        type: "upsertIngredient",
        id: tomatoId,
        name: "tomato",
        baseUnit: "g",
        purchaseUnit: { name: "kg", baseQuantity: 1000 },
        recipeUnit: { name: "g", baseQuantity: 1 },
        referenceCostCop: 4,
      },
    ],
  });

  const inventoryDatabase = purchasingEnabled
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
    recipeCatalogs: catalogs,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
    ...(inventoryDatabase ? { inventoryDatabase } : {}),
    ...(purchasingEnabled ? { purchasingEnabled: true } : {}),
  });

  return { application, inventoryDatabase };
};

const postReceipt = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/purchase-receipts`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const saleColumns = async (client: PGlite) => {
  const selected = await client.query<{
    order_line_id: string | null;
    role: string | null;
    recipe_version: number | null;
  }>("SELECT order_line_id, role, recipe_version FROM stock_movements");

  return selected.rows;
};

it("given purchasing is off, when a receipt is posted, then the route is skipped and nothing is listening", async () => {
  const { application } = await openCloud(false);

  try {
    const listening = application.getHttpAdapter().getInstance()
      .server.listening;
    const response = await postReceipt(
      application,
      "session_admin",
      receiptBody("receipt_off", pointId),
    );

    expect(listening).toBe(false);
    expect(response.statusCode).toBe(404);
    expect(() => application.get(PurchasingController)).toThrow();
  } finally {
    await application.close();
  }
});

it("given a waiter session, when a receipt is posted, then it is denied", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    expect(routePermissions["POST purchase-receipts"]).toBe(
      "inventory.receive-purchase",
    );
    expect(application.get(PurchasingController)).toBeInstanceOf(
      PurchasingController,
    );

    const response = await postReceipt(
      application,
      "session_waiter",
      receiptBody("receipt_waiter", pointId),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "PurchaseReceiveDenied" });
    expect(await saleColumns(inventoryDatabase as PGlite)).toEqual([]);
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});

it("given a warehouse keeper, when a receipt is recorded at the warehouse, then averageCost is omitted", async () => {
  const { application } = await openCloud(true);

  try {
    const response = await postReceipt(
      application,
      "session_keeper",
      receiptBody("receipt_keeper", warehouseId),
    );
    const body = response.json<Record<string, unknown>>();

    expect(response.statusCode).toBe(200);
    expect(purchaseReceipt.parse(body).lines[0]).toMatchObject({
      ingredientId: tomatoId,
      purchaseQuantity: 5,
      purchaseUnitCost: 4000,
      factor: kgFactor,
      quantity: 5 * kgFactor,
      unitCost: 4,
    });
    expect(JSON.stringify(body)).not.toContain("averageCost");
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});

it("given an administrator with inventory.view-cost, when the same receipt is posted twice, then averageCost is shown, sale columns stay null, and nothing is queued", async () => {
  const { application, inventoryDatabase } = await openCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    const first = await postReceipt(
      application,
      "session_admin",
      receiptBody("receipt_admin", pointId),
    );
    const repeated = await postReceipt(
      application,
      "session_admin",
      receiptBody("receipt_admin", pointId, 9),
    );
    const ledger = new DrizzleStockLedgerRepository(client);

    expect(first.statusCode).toBe(200);
    expect(repeated.statusCode).toBe(200);
    expect(first.json()).toEqual(repeated.json());
    expect(purchaseReceipt.parse(first.json())).toMatchObject({
      receiptId: "receipt_admin",
      locationId: pointId,
      purchaseOrderId: null,
      lines: [
        {
          ingredientId: tomatoId,
          purchaseQuantity: 5,
          purchaseUnitCost: 4000,
          factor: kgFactor,
          quantity: 5 * kgFactor,
          unitCost: 4,
          averageCost: 4,
        },
      ],
    });
    expect(await saleColumns(client)).toEqual([
      { order_line_id: null, role: null, recipe_version: null },
    ]);
    expect(await ledger.queued(tenantId)).toEqual([]);
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});

it("given a receipt that names a support document, when it is posted, then the response is 400", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    const response = await postReceipt(application, "session_admin", {
      ...receiptBody("receipt_invalid", pointId),
      supportDocument: "DS-1",
      vat: 19,
    });

    expect(response.statusCode).toBe(400);
    expect(await saleColumns(inventoryDatabase as PGlite)).toEqual([]);
  } finally {
    await application.close();
  }
});
