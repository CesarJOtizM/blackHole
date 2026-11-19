import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  productionCorrection,
  productionCostPolicy,
  productionRun,
} from "@blackhole/contracts";
import { InMemoryRecipeCatalogRepository } from "@blackhole/inventory/adapters/memory/in-memory-recipe-catalog-repository";
import { DrizzleStockLedgerRepository } from "@blackhole/inventory/adapters/postgres/drizzle-stock-ledger-repository";
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
import { afterAll, expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  ProductionController,
  routePermissions,
} from "#src/http/production.controller.js";

const tenantId = "organization_company_1";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const taxpayerId = "organization_taxpayer_1";
const pointId = "organization_point_1";
const sauceId = "recipe_tomato_sauce";
const sauceProductId = "product_tomato_sauce";
const pastaId = "recipe_pasta";
const pastaProductId = "product_pasta";
const tomatoId = "ingredient_tomato";
const onionId = "ingredient_onion";
const ownerId = "user_owner";
const adminId = "user_admin";
const waiterId = "user_waiter";
const chiefId = "user_chief";
const sessionHeader = "x-session-id";

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

const runBody = (
  runId: string,
  actualQuantity = 4600,
): Record<string, unknown> => ({
  runId,
  locationId: pointId,
  recipeId: sauceId,
  expectedQuantity: 5000,
  actualQuantity,
});

const openDatabase = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration("0001_recipe_catalog.sql"));
  await client.exec(migration("0002_stock_ledger.sql"));
  await client.exec(migration("0003_purchasing.sql"));
  await client.exec(migration("0006_production.sql"));
  return client;
};

const publishSauce = async (
  catalogs: InMemoryRecipeCatalogRepository,
): Promise<void> => {
  const catalog = RecipeCatalog.open({
    id: `recipe_catalog_${brandId}`,
    tenantId,
    brandId,
  });
  catalog.upsertIngredient({
    id: tomatoId,
    name: "tomato",
    baseUnit: BASE_UNIT.GRAM,
    purchaseUnit: { name: "g", baseQuantity: 1 },
    recipeUnit: { name: "g", baseQuantity: 1 },
    referenceCostCop: 4,
  });
  catalog.upsertIngredient({
    id: onionId,
    name: "onion",
    baseUnit: BASE_UNIT.GRAM,
    purchaseUnit: { name: "g", baseQuantity: 1 },
    recipeUnit: { name: "g", baseQuantity: 1 },
    referenceCostCop: 5,
  });
  catalog.upsertRecipe({
    id: sauceId,
    name: "tomato sauce",
    productId: sauceProductId,
    outputQuantity: 5000,
    lines: [
      {
        kind: "ingredient",
        ingredientId: tomatoId,
        netQuantity: 6000,
        yieldPercent: 100,
      },
      {
        kind: "ingredient",
        ingredientId: onionId,
        netQuantity: 500,
        yieldPercent: 100,
      },
    ],
  });
  catalog.upsertRecipe({
    id: pastaId,
    name: "pasta",
    productId: pastaProductId,
    lines: [
      {
        kind: "recipe",
        recipeId: sauceId,
        netQuantity: 80,
        yieldPercent: 100,
        stocked: true,
      },
    ],
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

const openCloud = async (productionEnabled: boolean) => {
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
  await publishSauce(catalogs);

  const inventoryDatabase = productionEnabled
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
    ...(productionEnabled ? { productionEnabled: true } : {}),
  });

  return { application, inventoryDatabase };
};

const postRun = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/production-runs`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const postCorrection = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  originalRunId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/production-runs/${originalRunId}/corrections`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const putPolicy = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
) =>
  application.inject({
    method: "PUT",
    url: `/tenants/${tenantId}/venues/${venueId}/production-cost-policy`,
    headers: { [sessionHeader]: sessionId },
    payload: {
      costRule: "consumed_average",
      preparations: [],
    },
  });

const saleColumns = async (client: PGlite) => {
  const selected = await client.query<{
    order_line_id: string | null;
    role: string | null;
    recipe_version: number | null;
  }>(
    "SELECT order_line_id, role, recipe_version FROM stock_movements ORDER BY position",
  );

  return selected.rows;
};

it("given production is off, when a run is posted, then the route is skipped and nothing is listening", async () => {
  const { application } = await openCloud(false);

  try {
    const listening = application.getHttpAdapter().getInstance()
      .server.listening;
    const response = await postRun(
      application,
      "session_admin",
      runBody("run_off"),
    );

    expect(listening).toBe(false);
    expect(response.statusCode).toBe(404);
    expect(() => application.get(ProductionController)).toThrow();
  } finally {
    await application.close();
  }
});

it("given a waiter session, when a run is posted, then it is denied", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    expect(routePermissions["POST production-runs"]).toBe(
      "inventory.record-production",
    );
    expect(routePermissions["POST production-corrections"]).toBe(
      "inventory.adjust",
    );
    expect(application.get(ProductionController)).toBeInstanceOf(
      ProductionController,
    );

    const response = await postRun(
      application,
      "session_waiter",
      runBody("run_waiter"),
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "ProductionRecordDenied" });
    expect(await saleColumns(inventoryDatabase as PGlite)).toEqual([]);
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});

it("given a kitchen chief without inventory.view-cost, when a run is recorded, then variance and output cost are omitted", async () => {
  const { application } = await openCloud(true);

  try {
    const policy = await putPolicy(application, "session_owner");
    const response = await postRun(
      application,
      "session_chief",
      runBody("run_chief"),
    );
    const body = response.json<Record<string, unknown>>();

    expect(policy.statusCode).toBe(200);
    expect(productionCostPolicy.parse(policy.json())).toEqual({
      costRule: "consumed_average",
      preparations: [],
    });
    expect(response.statusCode).toBe(200);
    expect(productionRun.parse(body)).toEqual({
      runId: "run_chief",
      locationId: pointId,
      recipeId: sauceId,
      expectedQuantity: 5000,
      actualQuantity: 4600,
    });
    expect(JSON.stringify(body)).not.toContain("variance");
    expect(JSON.stringify(body)).not.toContain("outputUnitCost");
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});

it("given an administrator with inventory.view-cost, when the same run is posted twice, then variance is shown, sale columns stay null, and nothing is queued", async () => {
  const { application, inventoryDatabase } = await openCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    const policy = await putPolicy(application, "session_owner");
    const first = await postRun(
      application,
      "session_admin",
      runBody("run_admin"),
    );
    const repeated = await postRun(
      application,
      "session_admin",
      runBody("run_admin", 1),
    );
    const ledger = new DrizzleStockLedgerRepository(client);

    expect(policy.statusCode).toBe(200);
    expect(first.statusCode).toBe(200);
    expect(repeated.statusCode).toBe(200);
    expect(first.json()).toEqual(repeated.json());
    expect(productionRun.parse(first.json())).toEqual({
      runId: "run_admin",
      locationId: pointId,
      recipeId: sauceId,
      expectedQuantity: 5000,
      actualQuantity: 4600,
      variance: -400,
      outputUnitCost: 0,
    });
    expect(await saleColumns(client)).toEqual([
      { order_line_id: null, role: null, recipe_version: 1 },
      { order_line_id: null, role: null, recipe_version: 1 },
      { order_line_id: null, role: null, recipe_version: 1 },
    ]);
    expect(await ledger.queued(tenantId)).toEqual([]);
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});

it("given a run that names an extra field, when it is posted, then the response is 400", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    const response = await postRun(application, "session_admin", {
      ...runBody("run_invalid"),
      note: "burned",
    });

    expect(response.statusCode).toBe(400);
    expect(await saleColumns(inventoryDatabase as PGlite)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief, when a run is corrected, then adjust is required and an owner compensation leaves nothing queued", async () => {
  const { application, inventoryDatabase } = await openCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    const policy = await putPolicy(application, "session_owner");
    const recorded = await postRun(
      application,
      "session_chief",
      runBody("run_correct"),
    );
    const denied = await postCorrection(
      application,
      "session_chief",
      "run_correct",
      { correctionRunId: "run_correct_denied" },
    );
    const corrected = await postCorrection(
      application,
      "session_owner",
      "run_correct",
      { correctionRunId: "run_correct_owner" },
    );
    const ledger = new DrizzleStockLedgerRepository(client);
    const rows = await saleColumns(client);

    expect(policy.statusCode).toBe(200);
    expect(recorded.statusCode).toBe(200);
    expect(denied.statusCode).toBe(403);
    expect(denied.json()).toEqual({ error: "ProductionCorrectionDenied" });
    expect(corrected.statusCode).toBe(200);
    expect(productionCorrection.parse(corrected.json())).toEqual({
      originalRunId: "run_correct",
      correctionRunId: "run_correct_owner",
    });
    expect(rows).toHaveLength(6);
    expect(
      rows.every((row) => row.order_line_id === null && row.role === null),
    ).toBe(true);
    expect(await ledger.queued(tenantId)).toEqual([]);
    expect(application.getHttpAdapter().getInstance().server.listening).toBe(
      false,
    );
  } finally {
    await application.close();
  }
});
