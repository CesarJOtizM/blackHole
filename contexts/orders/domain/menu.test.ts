import { expect, it } from "vitest";

import {
  ForeignModifier,
  InvalidMenuId,
  InvalidMenuPrice,
  Menu,
  MissingTaxClassification,
} from "#domain/menu.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const MENU_ID = "menu_brand_1";
const BURGER_ID = "menu_product_burger";
const SINGLE_ID = "menu_variant_single";
const DOUBLE_ID = "menu_variant_double";
const DRINK_ID = "menu_product_drink";
const NO_ICE_ID = "menu_modifier_no_ice";
const CHEESE_ID = "menu_modifier_extra_cheese";
const SODA_ID = "menu_product_soda";
const FISH_ID = "menu_product_fish";
const LUNCH_ID = "menu_combo_lunch";
const LEMONADE_ID = "menu_product_lemonade";
const BREAKFAST_ID = "menu_product_breakfast";
const SITE_S = "organization_venue_s";
const SITE_OTHER = "organization_venue_other";

const copyOf = (menu: Menu) => ({
  id: menu.id,
  tenantId: menu.tenantId,
  brandId: menu.brandId,
  products: menu.products,
  combos: menu.combos,
});

const openBrandMenu = () =>
  Menu.open({
    id: MENU_ID,
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
  });

it("given brand B with product Burger and variants single and double, when an admin of brand B publishes the product, then the menu lists Burger with both variants", () => {
  const menu = openBrandMenu();

  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
    variants: [
      { id: SINGLE_ID, name: "single" },
      { id: DOUBLE_ID, name: "double" },
    ],
  });

  expect(menu.id).toBe(MENU_ID);
  expect(menu.brandId).toBe(BRAND_ID);
  expect(menu.products).toEqual([
    {
      id: BURGER_ID,
      name: "Burger",
      price: 20_000,
      taxClassification: "restaurant service",
      variants: [
        { id: SINGLE_ID, name: "single" },
        { id: DOUBLE_ID, name: "double" },
      ],
      modifiers: [],
    },
  ]);
});

it("given a product without tax classification, when an admin publishes it, then publication is rejected and the menu stays unchanged", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
  });
  const before = copyOf(menu);

  const publish = () => {
    menu.publishProduct({
      id: LEMONADE_ID,
      name: "Lemonade",
      price: 8_000,
      taxClassification: "",
    });
  };

  expect(publish).toThrow(MissingTaxClassification);
  expect(copyOf(menu)).toEqual(before);
});

it("given modifier no ice belongs only to drinks, when it is attached to Burger in an order line, then the line is rejected and the menu stays unchanged", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: DRINK_ID,
    name: "Drink",
    price: 5_000,
    taxClassification: "restaurant service",
    modifiers: [{ id: NO_ICE_ID, name: "no ice", price: 0 }],
  });
  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
  });
  const before = copyOf(menu);

  const attach = () => {
    menu.attachLine({
      productId: BURGER_ID,
      modifierIds: [NO_ICE_ID],
    });
  };

  expect(attach).toThrow(ForeignModifier);
  expect(copyOf(menu)).toEqual(before);
});

it("given combo Lunch with a burger and a soda at 28000, when the combo is shown in the menu, then it appears as one item priced 28000 with its components listed", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
  });
  menu.publishProduct({
    id: SODA_ID,
    name: "Soda",
    price: 4_000,
    taxClassification: "restaurant service",
  });

  menu.publishCombo({
    id: LUNCH_ID,
    name: "Lunch",
    price: 28_000,
    componentIds: [BURGER_ID, SODA_ID],
  });

  expect(menu.combos).toEqual([
    {
      id: LUNCH_ID,
      name: "Lunch",
      price: 28_000,
      componentIds: [BURGER_ID, SODA_ID],
    },
  ]);
  expect(menu.products.map((product) => product.id)).toEqual([
    BURGER_ID,
    SODA_ID,
  ]);
});

it("given an identifier without the menu_ prefix, when a product is published, then it is rejected and the menu stays empty", () => {
  const menu = openBrandMenu();

  const publish = () => {
    menu.publishProduct({
      id: "product_burger",
      name: "Burger",
      price: 20_000,
      taxClassification: "restaurant service",
    });
  };

  expect(publish).toThrow(InvalidMenuId);
  expect(menu.products).toEqual([]);
});

it("given a price that is not an integer number of COP, when a product is published, then it is rejected and the menu stays empty", () => {
  const menu = openBrandMenu();

  const publish = () => {
    menu.publishProduct({
      id: BURGER_ID,
      name: "Burger",
      price: 20_000.5,
      taxClassification: "restaurant service",
    });
  };

  expect(publish).toThrow(InvalidMenuPrice);
  expect(menu.products).toEqual([]);
});

it("given Burger priced 20000 with modifier extra cheese at 3000, when a waiter selects the modifier, then the line price is 23000", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
    modifiers: [{ id: CHEESE_ID, name: "extra cheese", price: 3_000 }],
  });

  const price = menu.quote({
    productId: BURGER_ID,
    modifierIds: [CHEESE_ID],
  });

  expect(price).toBe(23_000);
});

it("given brand price 20000 for Burger, when site S sets 22000, then site S sells at 22000 and the brand product stays 20000", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
  });
  const before = copyOf(menu);

  menu.setVenuePrice({
    venueId: SITE_S,
    itemId: BURGER_ID,
    price: 22_000,
    available: true,
  });

  expect(copyOf(menu)).toEqual(before);
  expect(
    menu.quote({
      venueId: SITE_S,
      productId: BURGER_ID,
      modifierIds: [],
    }),
  ).toBe(22_000);
  expect(
    menu.quote({
      venueId: SITE_OTHER,
      productId: BURGER_ID,
      modifierIds: [],
    }),
  ).toBe(20_000);
});

it("given the soda of combo Lunch is unavailable at site S, when site S shows its menu, then Lunch stays listed and is not orderable", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
  });
  menu.publishProduct({
    id: SODA_ID,
    name: "Soda",
    price: 4_000,
    taxClassification: "restaurant service",
  });
  menu.publishCombo({
    id: LUNCH_ID,
    name: "Lunch",
    price: 28_000,
    componentIds: [BURGER_ID, SODA_ID],
  });
  const before = copyOf(menu);

  menu.setVenuePrice({
    venueId: SITE_S,
    itemId: SODA_ID,
    price: 4_000,
    available: false,
  });

  const shown = menu.viewAt({ venueId: SITE_S, minute: "12:00" });

  expect(copyOf(menu)).toEqual(before);
  expect(shown.combos).toEqual([
    {
      id: LUNCH_ID,
      name: "Lunch",
      price: 28_000,
      componentIds: [BURGER_ID, SODA_ID],
      orderable: false,
    },
  ]);
  expect(shown.products).toEqual([
    {
      id: BURGER_ID,
      name: "Burger",
      price: 20_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: true,
    },
    {
      id: SODA_ID,
      name: "Soda",
      price: 4_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: false,
    },
  ]);
});

it("given Breakfast is sold at site S from 07:00 to 11:00, when a waiter browses the menu at 12:00, then Breakfast stays listed with orderable false", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: BREAKFAST_ID,
    name: "Breakfast",
    price: 12_000,
    taxClassification: "restaurant service",
  });

  menu.setVenuePrice({
    venueId: SITE_S,
    itemId: BREAKFAST_ID,
    price: 12_000,
    available: true,
    window: { start: "07:00", end: "11:00" },
  });

  const atNoon = menu.viewAt({ venueId: SITE_S, minute: "12:00" });
  const duringService = menu.viewAt({ venueId: SITE_S, minute: "08:00" });
  const otherSiteAtNoon = menu.viewAt({
    venueId: SITE_OTHER,
    minute: "12:00",
  });

  expect(atNoon.products).toEqual([
    {
      id: BREAKFAST_ID,
      name: "Breakfast",
      price: 12_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: false,
    },
  ]);
  expect(duringService.products[0]?.orderable).toBe(true);
  expect(otherSiteAtNoon.products[0]?.orderable).toBe(true);
  expect(menu.products).toEqual([
    {
      id: BREAKFAST_ID,
      name: "Breakfast",
      price: 12_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
    },
  ]);
});

it("given the site disabled fish of the day manually and inventory allows 20 units, when the waiter opens the menu, then the product is not orderable", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: FISH_ID,
    name: "fish of the day",
    price: 32_000,
    taxClassification: "restaurant service",
  });
  menu.setVenuePrice({
    venueId: SITE_S,
    itemId: FISH_ID,
    price: 32_000,
    available: false,
  });
  menu.setInventoryState({
    venueId: SITE_S,
    productId: FISH_ID,
    state: "available",
  });

  const shown = menu.viewAt({ venueId: SITE_S, minute: "12:00" });

  expect(shown.products).toEqual([
    {
      id: FISH_ID,
      name: "fish of the day",
      price: 32_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: false,
      inventoryState: "available",
    },
  ]);
});

it("given a product enabled and in schedule whose state is low_units, when the waiter opens the menu, then the product stays orderable and flagged as low units", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: BURGER_ID,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
  });
  menu.setVenuePrice({
    venueId: SITE_S,
    itemId: BURGER_ID,
    price: 20_000,
    available: true,
    window: { start: "11:00", end: "15:00" },
  });
  menu.setInventoryState({
    venueId: SITE_S,
    productId: BURGER_ID,
    state: "low_units",
  });

  const shown = menu.viewAt({ venueId: SITE_S, minute: "12:00" });

  expect(shown.products).toEqual([
    {
      id: BURGER_ID,
      name: "Burger",
      price: 20_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: true,
      inventoryState: "low_units",
    },
  ]);
});

it("given a bottled soda has no inventory state, when the waiter opens the menu, then presentProduct omits inventoryState and the soda follows manual availability", () => {
  const menu = openBrandMenu();
  menu.publishProduct({
    id: SODA_ID,
    name: "Soda",
    price: 4_000,
    taxClassification: "restaurant service",
  });
  menu.setVenuePrice({
    venueId: SITE_S,
    itemId: SODA_ID,
    price: 4_000,
    available: true,
  });

  const shown = menu.viewAt({ venueId: SITE_S, minute: "12:00" });

  expect(shown.products).toEqual([
    {
      id: SODA_ID,
      name: "Soda",
      price: 4_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: true,
    },
  ]);
  expect(shown.products[0]).not.toHaveProperty("inventoryState");
});
