import { expect, it, vi } from "vitest";

import { InMemoryMenuRepository } from "#adapters/memory/in-memory-menu-repository.js";
import { InMemoryVenueDirectory } from "#adapters/memory/in-memory-venue-directory.js";
import { Clock } from "#application/ports/clock.js";
import {
  type MenuCommand,
  UpdateMenu,
} from "#application/update-menu/update-menu.js";
import { ViewVenueMenu } from "#application/view-venue-menu/view-venue-menu.js";

const TENANT_ID = "organization_tenant_1";
const BRAND_A = "organization_brand_a";
const BRAND_B = "organization_brand_b";
const BURGER_ID = "menu_product_burger";
const SODA_ID = "menu_product_soda";
const BREAKFAST_ID = "menu_product_breakfast";
const NOON_ID = "menu_product_noon";
const SITE_S = "organization_venue_s";
const SITE_FOREIGN = "organization_venue_foreign";
const SITE_UNKNOWN = "organization_venue_unknown";
const NOON_IN_BOGOTA = Date.parse("2026-10-26T17:00:00.000Z");

class FixedClock extends Clock {
  override now(): number {
    return NOON_IN_BOGOTA;
  }
}

const product = (id: string, name: string, price: number): MenuCommand => ({
  type: "publishProduct",
  id,
  name,
  price,
  taxClassification: "restaurant service",
});

const openRead = (repository: InMemoryMenuRepository) => {
  const venues = new InMemoryVenueDirectory({
    [`${TENANT_ID}:${SITE_S}`]: BRAND_A,
    [`${TENANT_ID}:${SITE_FOREIGN}`]: BRAND_B,
  });

  return {
    updateMenu: new UpdateMenu(repository, venues),
    viewMenu: new ViewVenueMenu(repository, venues, new FixedClock()),
  };
};

it("given site S belongs to brand A, when site S requests its menu, then no product of brand B is returned", async () => {
  const repository = new InMemoryMenuRepository();
  const { updateMenu, viewMenu } = openRead(repository);
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_A,
    command: product(BURGER_ID, "Burger", 20_000),
  });
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_B,
    command: product(SODA_ID, "Soda", 4_000),
  });
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_A,
    command: {
      type: "setVenuePrice",
      venueId: SITE_S,
      itemId: BURGER_ID,
      price: 22_000,
      available: true,
    },
  });
  const save = vi.spyOn(repository, "save");

  const shown = await viewMenu.execute({
    tenantId: TENANT_ID,
    venueId: SITE_S,
  });

  expect(save).not.toHaveBeenCalled();
  expect(shown?.products).toEqual([
    {
      id: BURGER_ID,
      name: "Burger",
      price: 22_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: true,
    },
  ]);
  expect(shown?.products.map((item) => item.id)).not.toContain(SODA_ID);
  expect(shown?.combos).toEqual([]);
});

it("given brand A has a published menu, when an unknown venue requests the menu, then brand A's menu is not revealed and nothing is saved", async () => {
  const repository = new InMemoryMenuRepository();
  const { updateMenu, viewMenu } = openRead(repository);
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_A,
    command: product(BURGER_ID, "Burger", 20_000),
  });
  const save = vi.spyOn(repository, "save");
  const load = vi.spyOn(repository, "load");

  const shown = await viewMenu.execute({
    tenantId: TENANT_ID,
    venueId: SITE_UNKNOWN,
  });

  expect(shown).toBeNull();
  expect(load).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  load.mockRestore();
  const stored = await repository.load(TENANT_ID, BRAND_A);
  expect(stored?.products.map((item) => item.id)).toEqual([BURGER_ID]);
});

it("given site S belongs to brand A, when a venue of brand B requests the menu, then no product of brand A is returned and nothing is saved", async () => {
  const repository = new InMemoryMenuRepository();
  const { updateMenu, viewMenu } = openRead(repository);
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_A,
    command: product(BURGER_ID, "Burger", 20_000),
  });
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_B,
    command: product(SODA_ID, "Soda", 4_000),
  });
  const save = vi.spyOn(repository, "save");
  const load = vi.spyOn(repository, "load");

  const shown = await viewMenu.execute({
    tenantId: TENANT_ID,
    venueId: SITE_FOREIGN,
  });

  expect(save).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith(TENANT_ID, BRAND_B);
  expect(load).not.toHaveBeenCalledWith(TENANT_ID, BRAND_A);
  expect(shown?.products.map((item) => item.id)).toEqual([SODA_ID]);
  expect(shown?.products.map((item) => item.id)).not.toContain(BURGER_ID);
});

it("given Breakfast is sold at site S from 07:00 to 11:00, when a waiter browses the menu at 12:00 in Bogota, then Breakfast stays listed with orderable false", async () => {
  const repository = new InMemoryMenuRepository();
  const { updateMenu, viewMenu } = openRead(repository);
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_A,
    command: product(BREAKFAST_ID, "Breakfast", 12_000),
  });
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_A,
    command: product(NOON_ID, "Noon", 15_000),
  });
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_A,
    command: {
      type: "setVenuePrice",
      venueId: SITE_S,
      itemId: BREAKFAST_ID,
      price: 12_000,
      available: true,
      window: { start: "07:00", end: "11:00" },
    },
  });
  await updateMenu.execute({
    tenantId: TENANT_ID,
    brandId: BRAND_A,
    command: {
      type: "setVenuePrice",
      venueId: SITE_S,
      itemId: NOON_ID,
      price: 15_000,
      available: true,
      window: { start: "12:00", end: "12:00" },
    },
  });
  const save = vi.spyOn(repository, "save");

  const shown = await viewMenu.execute({
    tenantId: TENANT_ID,
    venueId: SITE_S,
  });

  expect(save).not.toHaveBeenCalled();
  expect(shown?.products).toEqual([
    {
      id: BREAKFAST_ID,
      name: "Breakfast",
      price: 12_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: false,
    },
    {
      id: NOON_ID,
      name: "Noon",
      price: 15_000,
      taxClassification: "restaurant service",
      variants: [],
      modifiers: [],
      orderable: true,
    },
  ]);
});
