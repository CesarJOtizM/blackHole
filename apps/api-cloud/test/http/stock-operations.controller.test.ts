import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { InMemoryRecipeCatalogRepository } from "@blackhole/inventory/adapters/memory/in-memory-recipe-catalog-repository";
import { BASE_UNIT, RecipeCatalog } from "@blackhole/inventory/domain";
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
import { StockOperationsController } from "#src/http/stock-operations.controller.js";

const tenantId = "organization_company_1";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const taxpayerId = "organization_taxpayer_1";
const pointId = "organization_point_1";
const beefId = "ingredient_beef";
const milkId = "ingredient_milk";
const ownerId = "user_owner";
const chiefId = "user_kitchen_chief";
const sessionHeader = "x-session-id";
const openedAt = Date.parse("2026-11-13T21:00:00.000Z");
const cutOff = "2026-11-13T18:00:00.000Z";
const openingAt = "2026-11-13T08:00:00.000Z";
const saleAt = "2026-11-13T19:00:00.000Z";
const quantityScale = 1000;
const beefCost = 3000;
const openingGrams = 8000;
const countedPurchaseUnits = 7;
const laterSaleGrams = 200;
const frozenGrams = 1000;
const wasteMillilitres = 11250;
const wasteCost = 4;

const grams = (quantity: number): number => quantity * quantityScale;

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

const wasteUrl = `/tenants/${tenantId}/venues/${venueId}/operational-waste`;
const countUrl = `/tenants/${tenantId}/venues/${venueId}/stock-counts`;
const sheetUrl = `/tenants/${tenantId}/venues/${venueId}/stock-count-sheets?locationId=${pointId}&cutOff=${encodeURIComponent(cutOff)}&scope=full`;

const approvalUrl = (documentId: string): string =>
  `/tenants/${tenantId}/venues/${venueId}/stock-counts/${documentId}/approval`;

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

const wasteBody = (documentId: string, reason: string) => ({
  locationId: pointId,
  ingredientId: milkId,
  documentId,
  quantity: grams(wasteMillilitres),
  averageCost: wasteCost,
  reason,
});

const countBody = (documentId: string) => ({
  locationId: pointId,
  documentId,
  cutOff,
  scope: "full",
  lines: [{ ingredientId: beefId, purchaseQuantity: countedPurchaseUnits }],
});

const roleCount = async (client: PGlite, role: string): Promise<number> => {
  const selected = await client.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM stock_movements WHERE role = $1",
    [role],
  );

  return Number(selected.rows[0]?.count ?? 0);
};

const adjustment = async (
  client: PGlite,
): Promise<{ quantity: number; unitCost: number } | null> => {
  const selected = await client.query<{ quantity: number; unit_cost: number }>(
    "SELECT quantity, unit_cost FROM stock_movements WHERE role = 'count_adjustment'",
  );
  const row = selected.rows[0];

  if (!row) {
    return null;
  }

  return { quantity: Number(row.quantity), unitCost: Number(row.unit_cost) };
};

const publishBeef = async (
  catalogs: InMemoryRecipeCatalogRepository,
): Promise<void> => {
  const catalog = RecipeCatalog.open({
    id: `recipe_catalog_${brandId}`,
    tenantId,
    brandId,
  });
  catalog.upsertIngredient({
    id: beefId,
    name: "beef",
    baseUnit: BASE_UNIT.GRAM,
    purchaseUnit: { name: "g", baseQuantity: 1 },
    recipeUnit: { name: "g", baseQuantity: 1 },
    referenceCostCop: beefCost,
  });
  const version = catalog.publish({ authorId: ownerId });
  const published = catalog.publishedVersion(version);
  await catalogs.save(catalog, {
    tenantId,
    brandId,
    version,
    authorId: published.authorId,
    ingredients: published.ingredients,
    recipes: published.recipes,
    modifiers: published.modifiers,
  });
};

const seedLedger = async (client: PGlite): Promise<void> => {
  await client.query(
    `INSERT INTO stock_movements (
      tenant_id, id, position, venue_id, location_id, ingredient_id,
      quantity, unit_cost, movement_type, reference, occurred_at,
      order_line_id, role, recipe_version
    ) VALUES
      ($1, 'movement_opening_beef', 1, $2, $3, $4, $5, $6, 'purchase', 'receipt_opening', $7, 'receipt_opening', 'consumption', 1),
      ($1, 'movement_later_sale', 2, $2, $3, $4, $8, $6, 'sale_consumption', 'sale_later', $9, 'sale_later', 'consumption', 1)`,
    [
      tenantId,
      venueId,
      pointId,
      beefId,
      grams(openingGrams),
      beefCost,
      openingAt,
      -grams(laterSaleGrams),
      saleAt,
    ],
  );
};

const openDatabase = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration("0001_recipe_catalog.sql"));
  await client.exec(migration("0002_stock_ledger.sql"));
  await client.exec(migration("0008_waste_and_counts.sql"));
  await client.exec(migration("0010_waste_count_outbox.sql"));
  await seedLedger(client);
  return client;
};

const openCloud = async (wasteAndCountsEnabled: boolean) => {
  const identities = new InMemoryIdentityRepository();
  const organizations = new InMemoryOrganizationRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const catalogs = new InMemoryRecipeCatalogRepository();
  const passwords = new FastPasswordHasher();
  const clock = new FakeClock(openedAt);
  const identity = Identity.open(tenantId);
  const people = [
    [ownerId, "session_owner"],
    [chiefId, "session_chief"],
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
  await publishBeef(catalogs);

  const inventoryDatabase = wasteAndCountsEnabled
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
    ...(wasteAndCountsEnabled ? { wasteAndCountsEnabled: true } : {}),
  });

  return { application, inventoryDatabase };
};

const listening = (application: NestFastifyApplication): boolean =>
  application.getHttpAdapter().getInstance().server.listening;

it("given waste and counts are off, when waste, a count, and an approval are posted, then the routes are skipped and nothing is listening", async () => {
  const { application } = await openCloud(false);

  try {
    const waste = await post(
      application,
      wasteUrl,
      "session_chief",
      wasteBody("waste_off", "expired"),
    );
    const count = await post(
      application,
      countUrl,
      "session_chief",
      countBody("count_off"),
    );
    const approval = await post(
      application,
      approvalUrl("count_off"),
      "session_owner",
      { countedBy: chiefId, decision: "approve" },
    );
    const sheet = await application.inject({
      method: "GET",
      url: sheetUrl,
      headers: { [sessionHeader]: "session_chief" },
    });

    expect(listening(application)).toBe(false);
    expect(waste.statusCode).toBe(404);
    expect(count.statusCode).toBe(404);
    expect(approval.statusCode).toBe(404);
    expect(sheet.statusCode).toBe(404);
    expect(() => application.get(StockOperationsController)).toThrow();
  } finally {
    await application.close();
  }
});

it("given a kitchen chief over the 30000 COP waste cap and no other authorizer, when 45000 COP of expired milk is posted, then nothing is stored", async () => {
  const { application, inventoryDatabase } = await openCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    const response = await post(
      application,
      wasteUrl,
      "session_chief",
      wasteBody("waste_over_cap", "expired"),
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      posted: false,
      outcome: "requires_authorization",
      exceededLimit: { code: "wasteCop", cap: 30_000, unit: "cop" },
    });
    expect(await roleCount(client, "operational_waste")).toBe(0);
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a waste reason outside expired, damaged, preparation_error, and other, when it is posted, then the response is 400 and nothing is stored", async () => {
  const { application, inventoryDatabase } = await openCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    const response = await post(
      application,
      wasteUrl,
      "session_chief",
      wasteBody("waste_bad_reason", "stolen"),
    );

    expect(response.statusCode).toBe(400);
    expect(await roleCount(client, "operational_waste")).toBe(0);
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given beef on hand before the cut-off, when the count sheet is opened, then the response lists the ingredient and hides the theoretical quantity and cost", async () => {
  const { application } = await openCloud(true);

  try {
    const sheet = await application.inject({
      method: "GET",
      url: sheetUrl,
      headers: { [sessionHeader]: "session_chief" },
    });
    const body = sheet.body;

    expect(sheet.statusCode).toBe(200);
    expect(sheet.json()).toEqual({ ingredientIds: [beefId] });
    expect(body).not.toContain(String(grams(openingGrams)));
    expect(body).not.toContain(String(beefCost));
    expect(body).not.toContain("averageCost");
    expect(body).not.toContain("onHand");
    expect(body).not.toContain("theoretical");
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a count frozen above the 1000 COP cap and a sale after cut-off, when another person approves it, then the response is that freeze", async () => {
  const documentId = "count_beef_over_cap";
  const { application, inventoryDatabase } = await openCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    const submitted = await post(
      application,
      countUrl,
      "session_chief",
      countBody(documentId),
    );
    const approved = await post(
      application,
      approvalUrl(documentId),
      "session_owner",
      { countedBy: chiefId, decision: "approve" },
    );

    expect(submitted.statusCode).toBe(200);
    expect(submitted.json()).toMatchObject({
      posted: false,
      outcome: "requires_authorization",
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toEqual({
      posted: true,
      locationId: pointId,
      valueCop: 3000,
      lines: [
        {
          locationId: pointId,
          movementId: `movement_${documentId}_${beefId}`,
          ingredientId: beefId,
          quantity: -grams(frozenGrams),
          valueCop: 3000,
          averageCost: beefCost,
        },
      ],
    });
    expect(await adjustment(client)).toEqual({
      quantity: -grams(frozenGrams),
      unitCost: beefCost,
    });
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});
