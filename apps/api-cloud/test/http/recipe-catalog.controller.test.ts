import { InMemoryRecipeCatalogRepository } from "@blackhole/inventory/adapters/memory/in-memory-recipe-catalog-repository";
import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
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
import { expect, it } from "vitest";
import * as XLSX from "xlsx";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  RecipeCatalogController,
  routePermissions,
} from "#src/http/recipe-catalog.controller.js";

const tenantId = "organization_company_1";
const brandId = "organization_brand_1";
const venueId = "organization_venue_1";
const taxpayerId = "organization_taxpayer_1";
const ownerId = "user_owner";
const adminId = "user_admin";
const waiterId = "user_waiter";
const sessionHeader = "x-session-id";
const productId = "menu_burger";
const onionId = "ingredient_onion";
const recipeId = "recipe_burger";
const catalogId = `recipe_catalog_${brandId}`;

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

const publishBurger = {
  commands: [
    {
      type: "upsertIngredient",
      id: onionId,
      name: "onion",
      baseUnit: "g",
      purchaseUnit: { name: "g", baseQuantity: 1 },
      recipeUnit: { name: "g", baseQuantity: 1 },
      referenceCostCop: 80,
    },
    {
      type: "upsertRecipe",
      id: recipeId,
      name: "burger",
      productId,
      lines: [
        {
          kind: "ingredient",
          ingredientId: onionId,
          netQuantity: 100,
          yieldPercent: 100,
        },
      ],
    },
  ],
};

const publishMenu = {
  brandId,
  command: {
    type: "publishProduct",
    id: productId,
    name: "Burger",
    price: 20_000,
    taxClassification: "iva_19",
  },
};

const rejectedWorkbook = (): string => {
  const ingredients = XLSX.utils.aoa_to_sheet([
    [
      "id",
      "name",
      "baseUnit",
      "purchaseUnit",
      "purchaseBaseQuantity",
      "recipeUnit",
      "recipeBaseQuantity",
      "referenceCostCop",
    ],
    [onionId, "onion", "g", "g", 1, "g", 1, 80],
  ]);
  const header = [
    "recipeId",
    "recipeName",
    "productId",
    "variantId",
    "kind",
    "ingredientId",
    "subRecipeId",
    "stocked",
    "netQuantity",
    "yieldPercent",
  ];
  const rows: unknown[][] = [header];

  for (let row = 2; row < 17; row += 1) {
    rows.push(header.map(() => ""));
  }

  rows.push([
    recipeId,
    "burger",
    productId,
    "",
    "ingredient",
    "ingredient_missing",
    "",
    false,
    10,
    100,
  ]);
  const recipes = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, ingredients, "ingredients");
  XLSX.utils.book_append_sheet(book, recipes, "recipes");

  return XLSX.write(book, { type: "base64", bookType: "xlsx" }) as string;
};

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const organizations = new InMemoryOrganizationRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const audits = new InMemoryAuditRepository();
  const menus = new InMemoryMenuRepository();
  const catalogs = new InMemoryRecipeCatalogRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const people = [
    [ownerId, "session_owner"],
    [adminId, "session_admin"],
    [waiterId, "session_waiter"],
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
    pointId: "organization_point_1",
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

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations,
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(0),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, new FakeClock(0)),
    authorizations,
    audits,
    menus,
    recipeCatalogs: catalogs,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, catalogs, audits };
};

const postCatalog = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
  payload: unknown,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/brands/${brandId}/recipe-catalog`,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const postImport = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
) =>
  application.inject({
    method: "POST",
    url: `/tenants/${tenantId}/brands/${brandId}/recipe-catalog/import`,
    headers: { [sessionHeader]: sessionId },
    payload: { contents: rejectedWorkbook() },
  });

const getCost = (
  application: Awaited<ReturnType<typeof createApplication>>,
  sessionId: string,
) =>
  application.inject({
    method: "GET",
    url: `/tenants/${tenantId}/venues/${venueId}/recipes/${productId}/cost`,
    headers: { [sessionHeader]: sessionId },
  });

it("given an owner session, when POST /recipe-catalog publishes a recipe, then the response is 200, version 1 is stored, and the audit records both versions", async () => {
  const { application, catalogs, audits } = await openCloud();

  try {
    expect(routePermissions["POST recipe-catalog"]).toBe("recipe.edit");
    expect(routePermissions["POST recipe-catalog/import"]).toBe("recipe.edit");
    expect(routePermissions["GET recipe-catalog"]).toBe("recipe.edit");
    expect(routePermissions["GET recipe-cost"]).toBe("inventory.view-cost");
    expect(application.get(RecipeCatalogController)).toBeInstanceOf(
      RecipeCatalogController,
    );

    const response = await postCatalog(
      application,
      "session_owner",
      publishBurger,
    );
    const catalog = await catalogs.load(tenantId, brandId);
    const publications = await catalogs.listPublications(tenantId, brandId);
    const listed = await application.inject({
      method: "GET",
      url: `/tenants/${tenantId}/brands/${brandId}/recipe-catalog`,
      headers: { [sessionHeader]: "session_owner" },
    });
    const events = await audits.list(tenantId, null);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        tenantId,
        brandId,
        version: 1,
        authorId: ownerId,
      }),
    );
    expect(catalog?.currentVersion).toBe(1);
    expect(catalog?.id).toBe(catalogId);
    expect(publications).toHaveLength(1);
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({ publications: [response.json()] });
    expect(events).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        siteId: brandId,
        action: "recipe.edit",
        entity: catalogId,
        before: { version: null },
        after: { version: 1 },
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a site administrator without recipe edit, when they publish, then the response is 403 RecipeEditDenied and nothing is saved", async () => {
  const { application, catalogs, audits } = await openCloud();

  try {
    const response = await postCatalog(
      application,
      "session_admin",
      publishBurger,
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "RecipeEditDenied" });
    expect(await catalogs.load(tenantId, brandId)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a waiter session, when product cost is requested, then the response is 403 CostViewDenied and no amounts are returned", async () => {
  const { application } = await openCloud();

  try {
    const published = await postCatalog(
      application,
      "session_owner",
      publishBurger,
    );
    const priced = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/menu`,
      headers: { [sessionHeader]: "session_owner" },
      payload: publishMenu,
    });
    const response = await getCost(application, "session_waiter");
    const body = response.json<Record<string, unknown>>();

    expect(published.statusCode).toBe(200);
    expect(priced.statusCode).toBe(200);
    expect(response.statusCode).toBe(403);
    expect(body).toEqual({ error: "CostViewDenied" });
    expect(JSON.stringify(body)).not.toContain("8000");
    expect(JSON.stringify(body)).not.toContain("20000");
    expect(JSON.stringify(body)).not.toContain("costCop");
    expect(JSON.stringify(body)).not.toContain("marginPercent");
  } finally {
    await application.close();
  }
});

it("given exploded cost 8000 and price 20000, when an owner views the dish, then the response shows cost 8000 and margin 60", async () => {
  const { application } = await openCloud();

  try {
    const published = await postCatalog(
      application,
      "session_owner",
      publishBurger,
    );
    const priced = await application.inject({
      method: "POST",
      url: `/tenants/${tenantId}/menu`,
      headers: { [sessionHeader]: "session_owner" },
      payload: publishMenu,
    });
    const response = await getCost(application, "session_owner");

    expect(published.statusCode).toBe(200);
    expect(priced.statusCode).toBe(200);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ costCop: 8000, marginPercent: 60 });
  } finally {
    await application.close();
  }
});

it("given an owner session, when the import names an unknown ingredient on row 17, then the response is 409 RecipeImportRejected and nothing is saved", async () => {
  const { application, catalogs, audits } = await openCloud();

  try {
    const response = await postImport(application, "session_owner");

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "RecipeImportRejected",
      rows: [{ row: 17, reason: "Unknown ingredient." }],
    });
    expect(await catalogs.load(tenantId, brandId)).toBeNull();
    expect(await catalogs.listPublications(tenantId, brandId)).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /recipe-catalog sends an unknown field, then the response is 400 and nothing is saved", async () => {
  const { application, catalogs } = await openCloud();

  try {
    const response = await postCatalog(application, "session_owner", {
      commands: [],
      note: "extra",
    });

    expect(response.statusCode).toBe(400);
    expect(await catalogs.load(tenantId, brandId)).toBeNull();
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /recipe-catalog sets a unit factor to 0, then the response is 409 ZeroUnitFactor and nothing is saved", async () => {
  const { application, catalogs, audits } = await openCloud();

  try {
    const response = await postCatalog(application, "session_owner", {
      commands: [
        {
          type: "upsertIngredient",
          id: onionId,
          name: "onion",
          baseUnit: "g",
          purchaseUnit: { name: "50 kg sack", baseQuantity: 0 },
          recipeUnit: { name: "g", baseQuantity: 1 },
          referenceCostCop: 80,
        },
      ],
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "ZeroUnitFactor" });
    expect(await catalogs.load(tenantId, brandId)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
