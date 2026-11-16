import { InMemoryPointOfSaleDirectory } from "@blackhole/inventory/adapters/memory/in-memory-stock-ledger-repository";
import { PointOfSaleDirectory } from "@blackhole/inventory/application/ports/point-of-sale-directory";
import {
  CONSUMPTION_ROLE,
  StockLedgerRepository,
} from "@blackhole/inventory/application/ports/stock-ledger-repository";
import { MOVEMENT_TYPE, QUANTITY_SCALE } from "@blackhole/inventory/domain";
import { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import { InMemoryRealtimeHub } from "@blackhole/orders/adapters/memory/in-memory-realtime-hub";
import { InMemoryStationRouteRepository } from "@blackhole/orders/adapters/memory/in-memory-station-route-repository";
import { RealtimeHub } from "@blackhole/orders/application/ports/realtime-hub";
import { Menu } from "@blackhole/orders/domain";
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
import { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import {
  Authorization,
  Identity,
  Organization,
  VenueOperation,
} from "@blackhole/platform/domain";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import { routePermissions } from "#src/http/update-menu.controller.js";
import {
  checkId,
  diningPath,
  getDining,
  openedAt,
  ownerId,
  postDining,
  seatOccupiedCheck,
  sessionHeader,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const brandId = "organization_brand_1";
const pointId = "organization_point_1";
const waiterId = "user_waiter";
const burgerId = "menu_product_burger";
const fishId = "menu_product_fish";
const bunId = "ingredient_bun";
const filletId = "ingredient_fillet";
const burgerPrice = 20_000;
const fishPrice = 18_000;
const thresholdUrl = diningPath("low-units-threshold");
const menuUrl = diningPath("menu");
const sendUrl = diningPath(`checks/${checkId}/send`);
const recipeUrl = `/tenants/${tenantId}/brands/${brandId}/recipe-catalog`;
const window = { start: "07:00", end: "15:00" };

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

const units = (count: number): number => count * QUANTITY_SCALE;

const listening = (application: NestFastifyApplication): boolean =>
  application.getHttpAdapter().getInstance().server.listening;

const openCloud = async () => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const audits = new InMemoryAuditRepository();
  const organizations = new InMemoryOrganizationRepository();
  const passwords = new FastPasswordHasher();
  const clock = new FakeClock(Date.parse(openedAt));
  const identity = Identity.open(tenantId);
  const roster = [
    [ownerId, "session_owner", "owner"],
    [waiterId, "session_waiter", "waiter"],
  ] as const;

  for (const [userId, sessionId] of roster) {
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

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: roster.map(([userId, , roleId]) => ({
      id: `assignment_${roleId}`,
      userId,
      roleId,
      scopeKind: "company" as const,
      scopeId: tenantId,
      validFrom: null,
      validUntil: null,
    })),
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

  const organization = Organization.registerCompany({
    id: tenantId,
    name: "Pilot",
  });
  organization.addTaxpayer({
    id: "organization_taxpayer_1",
    nit: "900123",
    taxProfileId: "organization_tax_1",
  });
  organization.addBrand({ id: brandId, name: "House" });
  organization.openVenue({
    id: venueId,
    name: "North",
    brandId,
    taxpayerId: "organization_taxpayer_1",
    pointId,
  });
  const stored = picture(organization);
  await organizations.save(organization, {
    actorId: ownerId,
    before: stored,
    after: stored,
  });

  const menus = new InMemoryMenuRepository();
  const menu = Menu.open({
    id: `menu_${brandId}`,
    tenantId,
    brandId,
  });
  menu.publishProduct({
    id: burgerId,
    name: "Burger",
    price: burgerPrice,
    taxClassification: "restaurant service",
  });
  menu.publishProduct({
    id: fishId,
    name: "Fish",
    price: fishPrice,
    taxClassification: "restaurant service",
  });
  menu.setVenuePrice({
    venueId,
    itemId: burgerId,
    price: burgerPrice,
    available: true,
    window,
  });
  menu.setVenuePrice({
    venueId,
    itemId: fishId,
    price: fishPrice,
    available: true,
    window,
  });
  await menus.save(menu);

  const stationRoutes = new InMemoryStationRouteRepository();
  await stationRoutes.save({
    tenantId,
    venueId,
    stationId: "station_grill",
    stationName: "Grill",
    productId: burgerId,
    output: "both",
    redThresholdMinutes: 15,
  });
  await stationRoutes.save({
    tenantId,
    venueId,
    stationId: "station_grill",
    stationName: "Grill",
    productId: fishId,
    output: "both",
    redThresholdMinutes: 15,
  });

  const venueOperations = new InMemoryVenueOperationRepository();
  const diningRooms = new InMemoryDiningRoomRepository();
  const application = await createApplication({
    venueOperations,
    diningRooms,
    organizations,
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    authorizations,
    audits,
    menus,
    stationRoutes,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
    saleConsumptionEnabled: true,
  });
  const points = application.get(PointOfSaleDirectory);

  if (!(points instanceof InMemoryPointOfSaleDirectory)) {
    throw new Error("The cloud test expected the in-memory point directory.");
  }

  points.remember(tenantId, venueId, pointId);
  await application
    .get(VenueOperationRepository)
    .save(VenueOperation.openCloud(venueId));

  return { application, audits, diningRooms };
};

const seedStock = async (
  application: NestFastifyApplication,
  balances: readonly { ingredientId: string; count: number }[],
) => {
  await application.get(StockLedgerRepository).append({
    alerts: [],
    movements: balances.map((balance, index) => ({
      id: `movement_opening_${balance.ingredientId}`,
      tenantId,
      venueId,
      locationId: pointId,
      ingredientId: balance.ingredientId,
      quantity: units(balance.count),
      unitCost: 100,
      type: MOVEMENT_TYPE.PURCHASE,
      reference: "receipt_opening",
      occurredAt: openedAt,
      orderLineId: `receipt_opening_${index}`,
      role: CONSUMPTION_ROLE.CONSUMPTION,
      recipeVersion: 1,
      reason: null,
      actorId: null,
    })),
  });
};

const publishRecipes = (
  application: NestFastifyApplication,
  recipes: readonly {
    id: string;
    name: string;
    productId: string;
    ingredientId: string;
  }[],
) =>
  postDining(application, recipeUrl, "session_owner", {
    commands: [
      ...recipes.map((recipe) => ({
        type: "upsertIngredient",
        id: recipe.ingredientId,
        name: recipe.name,
        baseUnit: "unit",
        purchaseUnit: { name: "unit", baseQuantity: 1 },
        recipeUnit: { name: "unit", baseQuantity: 1 },
        referenceCostCop: 100,
      })),
      ...recipes.map((recipe) => ({
        type: "upsertRecipe",
        id: recipe.id,
        name: recipe.name,
        productId: recipe.productId,
        lines: [
          {
            kind: "ingredient",
            ingredientId: recipe.ingredientId,
            netQuantity: 1,
          },
        ],
      })),
    ],
  });

const availabilityEvents = (application: NestFastifyApplication) => {
  const hub = application.get(RealtimeHub);

  if (!(hub instanceof InMemoryRealtimeHub)) {
    throw new Error("The cloud test expected the in-memory realtime hub.");
  }

  return hub.published.filter(
    (notice) => notice.kind === "availability_changed",
  );
};

const sendLine = (
  application: NestFastifyApplication,
  sessionId: string,
  line: { lineId: string; productId: string; name: string },
) =>
  postDining(application, sendUrl, sessionId, {
    course: 1,
    lines: [
      {
        orderId: "order_1",
        lineId: line.lineId,
        productId: line.productId,
        name: line.name,
        course: 1,
        channel: "waiter",
      },
    ],
  });

it("given a waiter session, when the low-units threshold is set, then the request is denied", async () => {
  const { application, audits } = await openCloud();

  try {
    expect(listening(application)).toBe(false);
    expect(routePermissions["POST venues/:venueId/low-units-threshold"]).toBe(
      "inventory.configure-levels",
    );

    const response = await postDining(
      application,
      thresholdUrl,
      "session_waiter",
      { productId: burgerId, threshold: 5 },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "InventoryConfigureLevelsDenied",
    });
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when the burger threshold is set to 5, then the change is audited", async () => {
  const { application, audits } = await openCloud();

  try {
    const response = await postDining(
      application,
      thresholdUrl,
      "session_owner",
      { productId: burgerId, threshold: 5 },
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      productId: burgerId,
      lowUnitsThreshold: 5,
    });
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        siteId: venueId,
        action: "inventory.configure-levels",
        entity: burgerId,
        after: { lowUnitsThreshold: 5 },
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given five units under a threshold of 5, when the menu is read and a sold-out product is sent, then the flag is shown and the send succeeds", async () => {
  const { application, audits, diningRooms } = await openCloud();

  try {
    await seedStock(application, [{ ingredientId: bunId, count: 5 }]);
    const threshold = await postDining(
      application,
      thresholdUrl,
      "session_owner",
      { productId: burgerId, threshold: 5 },
    );
    const published = await publishRecipes(application, [
      {
        id: "recipe_burger",
        name: "Burger",
        productId: burgerId,
        ingredientId: bunId,
      },
      {
        id: "recipe_fish",
        name: "Fish",
        productId: fishId,
        ingredientId: filletId,
      },
    ]);
    const menu = await getDining(application, menuUrl, "session_waiter");
    await seatOccupiedCheck(diningRooms);
    const sent = await sendLine(application, "session_waiter", {
      lineId: "line_fish",
      productId: fishId,
      name: "Fish",
    });
    const after = await getDining(application, menuUrl, "session_waiter");
    const products = (
      after.json() as { products: { id: string; orderable: boolean }[] }
    ).products;

    expect(threshold.statusCode).toBe(200);
    expect(published.statusCode).toBe(200);
    expect(menu.statusCode).toBe(200);
    expect(menu.json()).toEqual({
      products: [
        expect.objectContaining({
          id: burgerId,
          orderable: true,
          inventoryState: "low_units",
        }),
        expect.objectContaining({
          id: fishId,
          orderable: true,
          inventoryState: "sold_out",
        }),
      ],
      combos: [],
    });
    expect(sent.statusCode).toBe(200);
    expect(products).toEqual([
      expect.objectContaining({
        id: burgerId,
        orderable: true,
        inventoryState: "low_units",
      }),
      expect.objectContaining({
        id: fishId,
        orderable: true,
        inventoryState: "sold_out",
      }),
    ]);
    expect(
      availabilityEvents(application).some(
        (notice) => "cost" in notice || "unitCost" in notice,
      ),
    ).toBe(false);
    expect(await audits.list(tenantId, null)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "inventory.configure-levels",
          after: { lowUnitsThreshold: 5 },
        }),
      ]),
    );
  } finally {
    await application.close();
  }
});

it("given 30 available units and no threshold, when one unit is sent, then no availability event is emitted", async () => {
  const { application, diningRooms } = await openCloud();

  try {
    await seedStock(application, [{ ingredientId: bunId, count: 30 }]);
    const published = await publishRecipes(application, [
      {
        id: "recipe_burger",
        name: "Burger",
        productId: burgerId,
        ingredientId: bunId,
      },
    ]);
    const before = availabilityEvents(application);
    await seatOccupiedCheck(diningRooms);
    const sent = await sendLine(application, "session_waiter", {
      lineId: "line_burger",
      productId: burgerId,
      name: "Burger",
    });
    const after = availabilityEvents(application);

    expect(published.statusCode).toBe(200);
    expect(sent.statusCode).toBe(200);
    expect(before).toEqual([
      {
        kind: "availability_changed",
        tenantId,
        venueId,
        productId: burgerId,
        variantId: null,
        state: "available",
      },
    ]);
    expect(after).toEqual(before);
  } finally {
    await application.close();
  }
});
