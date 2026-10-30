import { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
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
import {
  Authorization,
  Identity,
  Organization,
} from "@blackhole/platform/domain";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it } from "vitest";
import { MemoryChargeLedger } from "#src/composition/application-module.js";
import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import { OrdersAccount } from "#src/composition/orders-account.js";
import {
  ChargeCheckController,
  routePermissions,
} from "#src/http/charge-check.controller.js";
import {
  checkId,
  openedAt,
  ownerId,
  seatOccupiedCheck,
  sessionHeader,
  tableId,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const kitchenChiefId = "user_kitchen";
const registerId = "organization_register_front";
const brandId = "organization_brand_1";
const productId = "menu_product_1";
const lineId = "line_soup";
const orderId = "order_1";
const commandId = "command_charge_1";
const paymentId = "payment_cash_1";
const closureId = "closure_cash_1";
const menuClass = "food";
const accountCop = 85_000;

const people = [
  [ownerId, "session_owner", "owner"],
  [kitchenChiefId, "session_kitchen", "kitchenChief"],
] as const;

const chargeBody = {
  commandId,
  paymentId,
  closureId,
  tenders: [{ method: "cash", amountCop: accountCop }],
  tip: { method: "cash", amountCop: 0 },
};

const chargeUrl = `/tenants/${tenantId}/venues/${venueId}/cash-registers/${registerId}/checks/${checkId}/charge`;

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

const openChargeCloud = async (): Promise<{
  application: NestFastifyApplication;
  diningRooms: InMemoryDiningRoomRepository;
  charges: MemoryChargeLedger;
  audits: InMemoryAuditRepository;
}> => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const organizations = new InMemoryOrganizationRepository();
  const diningRooms = new InMemoryDiningRoomRepository();
  const menus = new InMemoryMenuRepository();
  const charges = new MemoryChargeLedger();
  const audits = new InMemoryAuditRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);

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
    id: "organization_taxpayer_1",
    nit: "900123",
    taxProfileId: "organization_tax_1",
  });
  organization.addBrand({ id: brandId, name: "Brand" });
  organization.openVenue({
    id: venueId,
    name: "Site one",
    brandId,
    taxpayerId: "organization_taxpayer_1",
    pointId: "organization_point_1",
  });
  organization.addCashRegister({
    id: registerId,
    venueId,
    name: "Front",
  });
  const stored = picture(organization);
  await organizations.save(organization, {
    actorId: ownerId,
    before: stored,
    after: stored,
  });

  const menu = Menu.open({ id: "menu_brand_1", tenantId, brandId });
  menu.publishProduct({
    id: productId,
    name: "Soup",
    price: accountCop,
    taxClassification: menuClass,
  });
  await menus.save(menu);

  const check = await seatOccupiedCheck(diningRooms);
  check.addLine({
    orderId,
    lineId,
    productId,
    name: "Soup",
    course: 1,
    price: accountCop,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: openedAt });
  await diningRooms.saveCheck(check);

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: people.map(([userId, , roleId]) => ({
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

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations,
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(Date.parse(openedAt)),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(
      identities,
      new FakeClock(Date.parse(openedAt)),
    ),
    authorizations,
    audits,
    diningRooms,
    menus,
    charges,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, diningRooms, charges, audits };
};

const postCharge = (
  application: NestFastifyApplication,
  sessionId: string,
  payload: unknown,
): Promise<{ statusCode: number; json: () => unknown }> =>
  application.inject({
    method: "POST",
    url: chargeUrl,
    headers: { [sessionHeader]: sessionId },
    payload: payload as Record<string, unknown>,
  });

const storedClosure = async (charges: MemoryChargeLedger) =>
  charges.findByCommand(tenantId, venueId, commandId);

it("given an occupied check of 85000, when POST charge pays that cash amount, then the response is 200, one queued closure is stored, and the table becomes to_clean once", async () => {
  const { application, diningRooms, charges, audits } = await openChargeCloud();

  try {
    expect(
      routePermissions[
        "POST cash-registers/:registerId/checks/:checkId/charge"
      ],
    ).toBe("sale.charge");
    expect(application.get(ChargeCheckController)).toBeInstanceOf(
      ChargeCheckController,
    );

    const response = await postCharge(application, "session_owner", chargeBody);
    const stored = await storedClosure(charges);
    const table = await diningRooms.load(tenantId, venueId, tableId);
    const accounts = application.get(OrdersAccount);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: closureId,
      status: "queued",
      commandId,
      checkId,
      tableId,
      registerId,
      paymentId,
      saleCop: accountCop,
      changeCop: 0,
      lines: [
        {
          lineId,
          productId,
          priceCop: accountCop,
          originTableId: tableId,
          menuClass,
        },
      ],
      tenders: [{ method: "cash", amountCop: accountCop }],
      tip: { method: "cash", amountCop: 0 },
    });
    expect(charges.insertions).toBe(1);
    expect(stored?.closure.status).toBe("queued");
    expect(stored?.closure.id).toBe(closureId);
    expect(stored?.closure.id.startsWith("closure_")).toBe(true);
    expect(stored?.closure.lines).toEqual([
      {
        lineId,
        productId,
        priceCop: accountCop,
        originTableId: tableId,
        menuClass,
      },
    ]);
    expect(accounts.markCount()).toBe(1);
    expect(table?.state).toBe("to_clean");
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        action: "sale.charge",
        entity: checkId,
        before: null,
        reason: "sale.charge",
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a paid check, when the same commandId is posted again, then the second call does not insert another closure and does not mark the table again", async () => {
  const { application, diningRooms, charges, audits } = await openChargeCloud();

  try {
    const first = await postCharge(application, "session_owner", chargeBody);
    const second = await postCharge(application, "session_owner", chargeBody);
    const stored = await storedClosure(charges);
    const table = await diningRooms.load(tenantId, venueId, tableId);
    const accounts = application.get(OrdersAccount);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(charges.insertions).toBe(1);
    expect(stored?.closure.id).toBe(closureId);
    expect(accounts.markCount()).toBe(1);
    expect(table?.state).toBe("to_clean");
    expect(await audits.list(tenantId, null)).toHaveLength(1);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST charge is injected, then the response is 403, nothing is saved, and the table stays occupied", async () => {
  const { application, diningRooms, charges, audits } = await openChargeCloud();

  try {
    const response = await postCharge(
      application,
      "session_kitchen",
      chargeBody,
    );
    const table = await diningRooms.load(tenantId, venueId, tableId);
    const accounts = application.get(OrdersAccount);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleChargeDenied" });
    expect(charges.insertions).toBe(0);
    expect(await storedClosure(charges)).toBeNull();
    expect(accounts.markCount()).toBe(0);
    expect(table?.state).toBe("occupied");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST charge sends a bad body, then the response is 400 and nothing is saved", async () => {
  const { application, diningRooms, charges, audits } = await openChargeCloud();

  try {
    const missing = await postCharge(application, "session_owner", {});
    const stamped = await postCharge(application, "session_owner", {
      ...chargeBody,
      occurredAt: openedAt,
    });
    const table = await diningRooms.load(tenantId, venueId, tableId);

    expect(missing.statusCode).toBe(400);
    expect(stamped.statusCode).toBe(400);
    expect(charges.insertions).toBe(0);
    expect(await storedClosure(charges)).toBeNull();
    expect(table?.state).toBe("occupied");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
