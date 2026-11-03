import type { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import {
  type OpenShiftQuery,
  OpenShiftReader,
} from "@blackhole/orders/application/entry-port";
import { Menu } from "@blackhole/orders/domain";
import { expect, it } from "vitest";

import {
  ChangePriceController,
  routePermissions,
} from "#src/http/change-price.controller.js";
import {
  checkId,
  diningPath,
  openDiningCloud,
  ownerId,
  postDining,
  seatOccupiedCheck,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const orderId = "order_1";
const lineId = "line_soup";
const productId = "menu_product_soup";
const linePrice = 22_000;
const catalogPrice = 20_000;
const venuePrice = 24_000;
const nextPrice = 18_000;
const shiftId = "shift_1";
const reason = "Manager adjusted the plate";
const brandId = "menu_brand_1";
const priceUrl = diningPath(`checks/${checkId}/lines/${lineId}/price`);

const command = {
  reason,
  shiftId,
  authorizationId: null,
  price: nextPrice,
};

class OpenCloudShift extends OpenShiftReader {
  override isOpen(_query: OpenShiftQuery): Promise<boolean> {
    return Promise.resolve(true);
  }
}

const holdSoup = async (diningRooms: InMemoryDiningRoomRepository) => {
  const check = await seatOccupiedCheck(diningRooms);

  check.addLine({
    orderId,
    lineId,
    productId,
    name: "Soup",
    course: 1,
    price: linePrice,
    channel: "waiter",
  });
  await diningRooms.saveCheck(check);
};

const storedLinePrices = async (diningRooms: InMemoryDiningRoomRepository) => {
  const stored = await diningRooms.loadCheck(tenantId, venueId, checkId);

  return (
    stored?.orders.flatMap((order) => order.lines.map((line) => line.price)) ??
    []
  );
};

const siteMenu = async () => {
  const menus = new InMemoryMenuRepository();
  const menu = Menu.open({ id: "menu_house", tenantId, brandId });

  menu.publishProduct({
    id: productId,
    name: "Soup",
    price: catalogPrice,
    taxClassification: "prepared_food",
  });
  menu.setVenuePrice({
    venueId,
    itemId: productId,
    price: venuePrice,
    available: true,
  });
  await menus.save(menu);

  return menus;
};

const storedMenuPrices = async (menus: InMemoryMenuRepository) => {
  const menu = await menus.load(tenantId, brandId);

  return {
    catalog: menu?.products.map((product) => product.price) ?? [],
    venue: menu?.venuePrices.map((price) => price.price) ?? [],
    quoted:
      menu?.quote({
        venueId,
        productId,
        modifierIds: [],
      }) ?? null,
  };
};

it("given a kitchen chief session and an open shift, when POST /checks/:checkId/lines/:lineId/price is injected, then the response is 200, the line price stays, and no price change is audited", async () => {
  const menus = await siteMenu();
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
    menus,
  });

  try {
    expect(routePermissions).toEqual({
      "POST checks/:checkId/lines/:lineId/price": "sale.change-price",
    });
    expect(application.get(ChangePriceController)).toBeInstanceOf(
      ChangePriceController,
    );
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      priceUrl,
      "session_kitchen",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkId, lineIds: [lineId] });
    expect(await storedLinePrices(diningRooms)).toEqual([linePrice]);
    expect(await storedMenuPrices(menus)).toEqual({
      catalog: [catalogPrice],
      venue: [venuePrice],
      quoted: venuePrice,
    });
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session and an open shift, when POST /checks/:checkId/lines/:lineId/price is injected, then the line price changes, the menu stays, and the audit records the previous price", async () => {
  const menus = await siteMenu();
  const { application, diningRooms, audits } = await openDiningCloud({
    shifts: new OpenCloudShift(),
    menus,
  });

  try {
    await holdSoup(diningRooms);

    const response = await postDining(
      application,
      priceUrl,
      "session_owner",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ checkId, lineIds: [lineId] });
    expect(await storedLinePrices(diningRooms)).toEqual([nextPrice]);
    expect(await storedMenuPrices(menus)).toEqual({
      catalog: [catalogPrice],
      venue: [venuePrice],
      quoted: venuePrice,
    });
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.change-price",
        actorId: ownerId,
        authorizerId: null,
        entity: lineId,
        reason,
        before: { value: linePrice },
        after: { value: nextPrice, shiftId, kitchen: null },
      }),
    ]);
  } finally {
    await application.close();
  }
});
