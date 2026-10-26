import { expect, it, vi } from "vitest";

import { InMemoryMenuRepository } from "#adapters/memory/in-memory-menu-repository.js";
import { VenueDirectory } from "#application/ports/venue-directory.js";
import {
  ForeignVenue,
  type MenuCommand,
  UpdateMenu,
} from "#application/update-menu/update-menu.js";
import { MissingTaxClassification } from "#domain/menu.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_ID = "organization_brand_1";
const OTHER_BRAND_ID = "organization_brand_2";
const BURGER_ID = "menu_product_burger";
const SINGLE_ID = "menu_variant_single";
const DOUBLE_ID = "menu_variant_double";
const SODA_ID = "menu_product_soda";
const LUNCH_ID = "menu_combo_lunch";
const LEMONADE_ID = "menu_product_lemonade";
const SITE_S = "organization_venue_s";
const SITE_OTHER = "organization_venue_other";
const SITE_FOREIGN = "organization_venue_foreign";

class MapVenueDirectory extends VenueDirectory {
  constructor(private readonly brands: Readonly<Record<string, string>>) {
    super();
  }

  override async brandOf(
    tenantId: string,
    venueId: string,
  ): Promise<string | null> {
    return this.brands[`${tenantId}:${venueId}`] ?? null;
  }
}

const product = (id: string, name: string, price: number): MenuCommand => ({
  type: "publishProduct",
  id,
  name,
  price,
  taxClassification: "restaurant service",
});

const venuesOf = () =>
  new MapVenueDirectory({
    [`${TENANT_ID}:${SITE_S}`]: BRAND_ID,
    [`${TENANT_ID}:${SITE_OTHER}`]: BRAND_ID,
    [`${TENANT_ID}:${SITE_FOREIGN}`]: OTHER_BRAND_ID,
  });

const openUpdate = (repository: InMemoryMenuRepository) =>
  new UpdateMenu(repository, venuesOf());

it("given brand B with product Burger and variants single and double, when an admin publishes the product, then the stored menu lists Burger with both variants", async () => {
  const repository = new InMemoryMenuRepository();
  const updateMenu = openUpdate(repository);

  const menu = await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: {
      type: "publishProduct",
      id: BURGER_ID,
      name: "Burger",
      price: 20_000,
      taxClassification: "restaurant service",
      variants: [
        { id: SINGLE_ID, name: "single" },
        { id: DOUBLE_ID, name: "double" },
      ],
    },
  });

  const stored = await repository.load(TENANT_ID, BRAND_ID);
  expect(menu.id).toBe(`menu_${BRAND_ID}`);
  expect(stored?.tenantId).toBe(TENANT_ID);
  expect(stored?.brandId).toBe(BRAND_ID);
  expect(stored?.products).toEqual([
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

it("given combo Lunch with a burger and a soda at 28000, when an admin publishes the combo, then the stored menu shows one item priced 28000 with its components", async () => {
  const repository = new InMemoryMenuRepository();
  const updateMenu = openUpdate(repository);
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: product(BURGER_ID, "Burger", 20_000),
  });
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: product(SODA_ID, "Soda", 4_000),
  });

  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: {
      type: "publishCombo",
      id: LUNCH_ID,
      name: "Lunch",
      price: 28_000,
      componentIds: [BURGER_ID, SODA_ID],
    },
  });

  const stored = await repository.load(TENANT_ID, BRAND_ID);
  expect(stored?.combos).toEqual([
    {
      id: LUNCH_ID,
      name: "Lunch",
      price: 28_000,
      componentIds: [BURGER_ID, SODA_ID],
    },
  ]);
});

it("given brand price 20000 for Burger, when site S sets 22000, then the stored menu sells site S at 22000 and the brand product stays 20000", async () => {
  const repository = new InMemoryMenuRepository();
  const updateMenu = openUpdate(repository);
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: product(BURGER_ID, "Burger", 20_000),
  });

  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: {
      type: "setVenuePrice",
      venueId: SITE_S,
      itemId: BURGER_ID,
      price: 22_000,
      available: true,
    },
  });

  const stored = await repository.load(TENANT_ID, BRAND_ID);
  expect(stored?.products[0]?.price).toBe(20_000);
  expect(
    stored?.quote({
      venueId: SITE_S,
      productId: BURGER_ID,
      modifierIds: [],
    }),
  ).toBe(22_000);
  expect(
    stored?.quote({
      venueId: SITE_OTHER,
      productId: BURGER_ID,
      modifierIds: [],
    }),
  ).toBe(20_000);
});

it("given a product without tax classification, when an admin publishes it, then publication is rejected and nothing is saved", async () => {
  const repository = new InMemoryMenuRepository();
  const updateMenu = openUpdate(repository);
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: product(BURGER_ID, "Burger", 20_000),
  });
  const before = await repository.load(TENANT_ID, BRAND_ID);
  const products = before?.products;
  const save = vi.spyOn(repository, "save");

  const publish = updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: {
      type: "publishProduct",
      id: LEMONADE_ID,
      name: "Lemonade",
      price: 8_000,
      taxClassification: "",
    },
  });

  await expect(publish).rejects.toThrow(MissingTaxClassification);
  expect(save).not.toHaveBeenCalled();
  const after = await repository.load(TENANT_ID, BRAND_ID);
  expect(after?.products).toEqual(products);
});

it("given site S belongs to brand A, when a venue of another brand sets a price, then the change is rejected and nothing is saved", async () => {
  const repository = new InMemoryMenuRepository();
  const updateMenu = openUpdate(repository);
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: product(BURGER_ID, "Burger", 20_000),
  });
  const before = await repository.load(TENANT_ID, BRAND_ID);
  const products = before?.products;
  const save = vi.spyOn(repository, "save");

  const setPrice = updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    command: {
      type: "setVenuePrice",
      venueId: SITE_FOREIGN,
      itemId: BURGER_ID,
      price: 22_000,
      available: true,
    },
  });

  await expect(setPrice).rejects.toThrow(ForeignVenue);
  expect(save).not.toHaveBeenCalled();
  const after = await repository.load(TENANT_ID, BRAND_ID);
  expect(after?.products).toEqual(products);
  expect(
    after?.quote({
      venueId: SITE_FOREIGN,
      productId: BURGER_ID,
      modifierIds: [],
    }),
  ).toBe(20_000);
});
