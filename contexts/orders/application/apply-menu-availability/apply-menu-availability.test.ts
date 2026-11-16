import { expect, it } from "vitest";

import { InMemoryMenuRepository } from "#adapters/memory/in-memory-menu-repository.js";
import { InMemoryRealtimeHub } from "#adapters/memory/in-memory-realtime-hub.js";
import { InMemoryVenueDirectory } from "#adapters/memory/in-memory-venue-directory.js";
import { ApplyMenuAvailability } from "#application/apply-menu-availability/apply-menu-availability.js";
import { Menu } from "#domain/menu.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const MENU_ID = "menu_brand_1";
const BURGER_ID = "menu_product_burger";
const SINGLE_ID = "menu_variant_single";
const SITE_S = "organization_venue_s";
const VIEW_MINUTE = "12:00";

const venuesOf = () =>
  new InMemoryVenueDirectory({
    [`${TENANT_ID}:${SITE_S}`]: BRAND_ID,
  });

const burgerMenu = (state?: "available" | "low_units" | "sold_out") => {
  const menu = Menu.open({
    id: MENU_ID,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });

  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
    variants: [{ id: SINGLE_ID, name: "single" }],
  });
  menu.setVenuePrice({
    venueId: SITE_S,
    itemId: BURGER_ID,
    price: 20_000,
    available: true,
  });

  if (state !== undefined) {
    menu.setInventoryState({
      venueId: SITE_S,
      productId: BURGER_ID,
      state,
    });
  }

  return menu;
};

const shownBurger = async (menus: InMemoryMenuRepository) => {
  const stored = await menus.load(TENANT_ID, BRAND_ID);
  const product = stored
    ?.viewAt({ venueId: SITE_S, minute: VIEW_MINUTE })
    .products.find((item) => item.id === BURGER_ID);

  return product;
};

it("given the burger is already available, when the same availability state is applied, then the hub does not publish", async () => {
  const menus = new InMemoryMenuRepository();
  const hub = new InMemoryRealtimeHub();
  await menus.save(burgerMenu("available"));
  const apply = new ApplyMenuAvailability(menus, venuesOf(), hub);

  await apply.execute({
    tenantId: TENANT_ID,
    venueId: SITE_S,
    productId: BURGER_ID,
    variantId: SINGLE_ID,
    state: "available",
  });

  expect(hub.published).toEqual([]);
  expect(await shownBurger(menus)).toMatchObject({
    orderable: true,
    inventoryState: "available",
  });
});

it("given the burger is available, when the state becomes sold out, then the hub sends sold_out and the product stays orderable", async () => {
  const menus = new InMemoryMenuRepository();
  const hub = new InMemoryRealtimeHub();
  await menus.save(burgerMenu("available"));
  const apply = new ApplyMenuAvailability(menus, venuesOf(), hub);

  await apply.execute({
    tenantId: TENANT_ID,
    venueId: SITE_S,
    productId: BURGER_ID,
    variantId: SINGLE_ID,
    state: "sold_out",
  });
  await apply.execute({
    tenantId: TENANT_ID,
    venueId: SITE_S,
    productId: BURGER_ID,
    variantId: SINGLE_ID,
    state: "sold_out",
  });

  expect(hub.published).toEqual([
    {
      kind: "availability_changed",
      tenantId: TENANT_ID,
      venueId: SITE_S,
      productId: BURGER_ID,
      variantId: SINGLE_ID,
      state: "sold_out",
    },
  ]);
  expect(await shownBurger(menus)).toMatchObject({
    orderable: true,
    inventoryState: "sold_out",
  });
});
