import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import { InMemoryPrinter } from "@blackhole/orders/adapters/memory/in-memory-printer";
import { InMemoryStationRouteRepository } from "@blackhole/orders/adapters/memory/in-memory-station-route-repository";
import { Menu } from "@blackhole/orders/domain";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import type { OrganizationSnapshot } from "@blackhole/platform/application/ports/organization-repository";
import { Organization } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import {
  routePermissions,
  TakeOrderController,
} from "#src/http/take-order.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  openedAt,
  ownerId,
  placeFreeTable,
  postDining,
  seatOccupiedCheck,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const brandId = "organization_brand_1";
const orderId = "order_1";
const lineId = "line_soup";
const laterLineId = "line_steak";
const soupId = "menu_product_soup";
const steakId = "menu_product_steak";
const soupPrice = 22_000;
const steakPrice = 45_000;
const linesUrl = diningPath(`checks/${checkId}/lines`);
const sendUrl = diningPath(`checks/${checkId}/send`);
const resendUrl = diningPath(`checks/${checkId}/lines/${lineId}/resend`);
const deliverUrl = diningPath(`checks/${checkId}/lines/${lineId}/deliver`);

const soupLine = {
  orderId,
  lineId,
  productId: soupId,
  name: "Soup",
  course: 1,
  channel: "waiter" as const,
};

const steakLine = {
  orderId,
  lineId: laterLineId,
  productId: steakId,
  name: "Steak",
  course: 2,
  channel: "waiter" as const,
};

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

const openOrderCloud = async (printerFails = false) => {
  const organizations = new InMemoryOrganizationRepository();
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
    pointId: "organization_point_1",
  });
  const stored = picture(organization);
  await organizations.save(organization, {
    actorId: ownerId,
    before: stored,
    after: stored,
  });

  const menus = new InMemoryMenuRepository();
  const menu = Menu.open({ id: "menu_brand_1", tenantId, brandId });
  menu.publishProduct({
    id: soupId,
    name: "Soup",
    price: 20_000,
    taxClassification: "restaurant service",
  });
  menu.publishProduct({
    id: steakId,
    name: "Steak",
    price: steakPrice,
    taxClassification: "restaurant service",
  });
  menu.setVenuePrice({
    venueId,
    itemId: soupId,
    price: soupPrice,
    available: true,
  });
  await menus.save(menu);

  const stationRoutes = new InMemoryStationRouteRepository();
  await stationRoutes.save({
    tenantId,
    venueId,
    stationId: "station_grill",
    stationName: "Grill",
    productId: soupId,
    output: "both",
    redThresholdMinutes: 15,
  });
  const printer = new InMemoryPrinter();
  printer.fail = printerFails;

  return {
    printer,
    ...(await openDiningCloud({
      organizations,
      menus,
      stationRoutes,
      printer,
    })),
  };
};

const heldSoup = {
  id: lineId,
  orderId,
  checkId,
  productId: soupId,
  name: "Soup",
  course: 1,
  price: soupPrice,
  state: "held",
  channel: "waiter",
};

const sentSoup = {
  ...heldSoup,
  state: "sent",
  sentAt: openedAt,
};

it("given an occupied check and a priced product, when POST /checks/:checkId/lines is injected, then the response is 200, the line stays held, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    expect(routePermissions).toEqual({
      "POST checks/:checkId/lines": "sale.open-table",
      "POST checks/:checkId/send": "sale.open-table",
      "POST checks/:checkId/lines/:lineId/resend": "sale.open-table",
      "POST checks/:checkId/lines/:lineId/deliver": "sale.open-table",
    });
    expect(application.get(TakeOrderController)).toBeInstanceOf(
      TakeOrderController,
    );
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(
      application,
      linesUrl,
      "session_owner",
      soupLine,
    );
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(heldSoup);
    expect(stored?.orders).toEqual([
      {
        id: orderId,
        channel: "waiter",
        lines: [
          expect.objectContaining({
            id: lineId,
            price: soupPrice,
            state: "held",
          }),
        ],
      },
    ]);
    expect(stored?.total).toBe(0);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST /checks/:checkId/lines is injected, then the response is 403, the check gains no line, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(
      application,
      linesUrl,
      "session_kitchen",
      soupLine,
    );
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleOpenTableDenied" });
    expect(stored?.orders).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /checks/:checkId/lines sends a client timestamp, then the response is 400 and nothing is saved", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(application, linesUrl, "session_owner", {
      ...soupLine,
      occurredAt: openedAt,
    });
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(400);
    expect(stored?.orders).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /checks/:checkId/lines omits x-session-id, then the response is 400 and nothing is saved", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await application.inject({
      method: "POST",
      url: linesUrl,
      payload: soupLine,
    });
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(400);
    expect(stored?.orders).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given no check, when POST /checks/:checkId/lines is injected, then the response is 409 and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    await placeFreeTable(diningRooms);

    const response = await postDining(
      application,
      linesUrl,
      "session_owner",
      soupLine,
    );
    const storedTable = await diningRooms.load(tenantId, venueId, "table_5");

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "TableNotOpen" });
    expect(storedTable?.state).toBe("free");
    expect(await diningRooms.loadCheck(tenantId, venueId, checkId)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given course 1 and a later course, when POST /checks/:checkId/send is injected, then course 1 is sent at the quoted price, the later course stays held, and the audit records the send", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(application, sendUrl, "session_owner", {
      course: 1,
      lines: [soupLine, steakLine],
    });
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);
    const events = await audits.list(tenantId, null);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checkId,
      course: 1,
      lines: [sentSoup],
    });
    expect(stored?.total).toBe(soupPrice);
    expect(stored?.orders).toEqual([
      {
        id: orderId,
        channel: "waiter",
        lines: [
          expect.objectContaining({
            id: lineId,
            state: "sent",
            price: soupPrice,
          }),
          expect.objectContaining({
            id: laterLineId,
            state: "held",
            price: steakPrice,
          }),
        ],
      },
    ]);
    expect(events).toEqual([
      expect.objectContaining({
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        action: "sale.open-table",
        entity: checkId,
        before: { course: 1, lineIds: [lineId], state: "held" },
        after: {
          course: 1,
          lineIds: [lineId],
          state: "sent",
          sentAt: openedAt,
        },
        reason: "sale.open-table",
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a held line, when POST /checks/:checkId/send names that course, then the line is sent and the audit records the send", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    const check = await seatOccupiedCheck(diningRooms);
    check.addLine({
      orderId,
      lineId,
      productId: soupId,
      name: "Soup",
      course: 1,
      price: soupPrice,
      channel: "waiter",
    });
    await diningRooms.saveCheck(check);

    const response = await postDining(application, sendUrl, "session_owner", {
      course: 1,
    });
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checkId,
      course: 1,
      lines: [sentSoup],
    });
    expect(stored?.total).toBe(soupPrice);
    expect(stored?.orders[0]?.lines[0]?.state).toBe("sent");
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.open-table",
        entity: checkId,
        before: { course: 1, lineIds: [lineId], state: "held" },
        after: {
          course: 1,
          lineIds: [lineId],
          state: "sent",
          sentAt: openedAt,
        },
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST /checks/:checkId/send is injected, then the response is 403, nothing is saved, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(application, sendUrl, "session_kitchen", {
      course: 1,
      lines: [soupLine],
    });
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleOpenTableDenied" });
    expect(stored?.orders).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST /checks/:checkId/send sends a client timestamp, then the response is 400 and nothing is saved", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(application, sendUrl, "session_owner", {
      course: 1,
      lines: [soupLine],
      occurredAt: openedAt,
    });
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(400);
    expect(stored?.orders).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an empty check, when POST /checks/:checkId/send names course 1, then the response is 409 and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(application, sendUrl, "session_owner", {
      course: 1,
    });
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "EmptyOrder" });
    expect(stored?.orders).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given output both and a failed printer, when POST /checks/:checkId/send is injected, then the response is 200 and the saved line is sent", async () => {
  const { application, diningRooms, audits } = await openOrderCloud(true);

  try {
    await seatOccupiedCheck(diningRooms);

    const response = await postDining(application, sendUrl, "session_owner", {
      course: 1,
      lines: [soupLine],
    });
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checkId,
      course: 1,
      lines: [sentSoup],
    });
    expect(stored?.orders[0]?.lines).toEqual([
      expect.objectContaining({
        id: lineId,
        state: "sent",
        price: soupPrice,
        sentAt: openedAt,
      }),
    ]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.open-table",
        entity: checkId,
        after: {
          course: 1,
          lineIds: [lineId],
          state: "sent",
          sentAt: openedAt,
        },
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a sent line, when POST /checks/:checkId/lines/:lineId/resend is injected, then the response is 200, the total stays, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    const check = await seatOccupiedCheck(diningRooms);
    check.addLine({
      orderId,
      lineId,
      productId: soupId,
      name: "Soup",
      course: 1,
      price: soupPrice,
      channel: "waiter",
    });
    check.send({ course: 1, sentAt: openedAt });
    await diningRooms.saveCheck(check);

    const response = await postDining(
      application,
      resendUrl,
      "session_owner",
      {},
    );
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(sentSoup);
    expect(stored?.total).toBe(soupPrice);
    expect(stored?.orders[0]?.lines[0]?.state).toBe("sent");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST /checks/:checkId/lines/:lineId/resend is injected, then the response is 403, the line stays sent, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    const check = await seatOccupiedCheck(diningRooms);
    check.addLine({
      orderId,
      lineId,
      productId: soupId,
      name: "Soup",
      course: 1,
      price: soupPrice,
      channel: "waiter",
    });
    check.send({ course: 1, sentAt: openedAt });
    await diningRooms.saveCheck(check);

    const response = await postDining(
      application,
      resendUrl,
      "session_kitchen",
      {},
    );
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleOpenTableDenied" });
    expect(stored?.total).toBe(soupPrice);
    expect(stored?.orders[0]?.lines[0]?.state).toBe("sent");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a ready line, when POST /checks/:checkId/lines/:lineId/deliver is injected, then the response is 200, the line is delivered, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    const check = await seatOccupiedCheck(diningRooms);
    check.addLine({
      orderId,
      lineId,
      productId: soupId,
      name: "Soup",
      course: 1,
      price: soupPrice,
      channel: "waiter",
    });
    check.send({ course: 1, sentAt: openedAt });
    check.advance({
      lineId,
      state: "in_preparation",
      at: openedAt,
    });
    check.advance({ lineId, state: "ready", at: openedAt });
    await diningRooms.saveCheck(check);

    const response = await postDining(
      application,
      deliverUrl,
      "session_owner",
      {},
    );
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...sentSoup,
      state: "delivered",
      deliveredAt: openedAt,
    });
    expect(stored?.orders[0]?.lines[0]?.state).toBe("delivered");
    expect(stored?.orders[0]?.lines[0]?.deliveredAt).toBe(openedAt);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief session, when POST /checks/:checkId/lines/:lineId/deliver is injected, then the response is 403, the line stays ready, and nothing is audited", async () => {
  const { application, diningRooms, audits } = await openOrderCloud();

  try {
    const check = await seatOccupiedCheck(diningRooms);
    check.addLine({
      orderId,
      lineId,
      productId: soupId,
      name: "Soup",
      course: 1,
      price: soupPrice,
      channel: "waiter",
    });
    check.send({ course: 1, sentAt: openedAt });
    check.advance({
      lineId,
      state: "in_preparation",
      at: openedAt,
    });
    check.advance({ lineId, state: "ready", at: openedAt });
    await diningRooms.saveCheck(check);

    const response = await postDining(
      application,
      deliverUrl,
      "session_kitchen",
      {},
    );
    const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "SaleOpenTableDenied" });
    expect(stored?.orders[0]?.lines[0]?.state).toBe("ready");
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
