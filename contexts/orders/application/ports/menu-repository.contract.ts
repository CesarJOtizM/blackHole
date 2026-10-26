import { expect, it } from "vitest";

import type { MenuRepository } from "#application/ports/menu-repository.js";
import { Menu } from "#domain/menu.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const BRAND_ID = "organization_brand_shared";
const PRODUCT_A = "menu_product_a";
const PRODUCT_B = "menu_product_b";
const BURGER_ID = "menu_product_burger";
const SINGLE_ID = "menu_variant_single";
const DOUBLE_ID = "menu_variant_double";
const CHEESE_ID = "menu_modifier_extra_cheese";
const SODA_ID = "menu_product_soda";
const LUNCH_ID = "menu_combo_lunch";
const SITE_S = "organization_venue_s";

const publishedMenu = (tenantId: string, menuId: string, productId: string) => {
  const menu = Menu.open({
    id: menuId,
    tenantId,
    brandId: BRAND_ID,
  });

  menu.publishProduct({
    id: productId,
    name: "Burger",
    price: 20_000,
    taxClassification: "restaurant service",
  });

  return menu;
};

export function menuRepositoryContract(
  createRepository: () => MenuRepository | Promise<MenuRepository>,
): void {
  it("given a menu with a product, a combo and a site price, when it is saved, then the same copy can be read back", async () => {
    const repository = await createRepository();
    const menu = Menu.open({
      id: "menu_brand_1",
      tenantId: TENANT_A,
      brandId: BRAND_ID,
    });
    menu.publishProduct({
      id: BURGER_ID,
      name: "Burger",
      price: 20_000,
      taxClassification: "restaurant service",
      variants: [
        { id: SINGLE_ID, name: "single" },
        { id: DOUBLE_ID, name: "double" },
      ],
      modifiers: [{ id: CHEESE_ID, name: "extra cheese", price: 3_000 }],
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
    menu.setVenuePrice({
      venueId: SITE_S,
      itemId: BURGER_ID,
      price: 22_000,
      available: true,
      window: { start: "07:00", end: "11:00" },
    });

    await repository.save(menu);

    const stored = await repository.load(menu.tenantId, menu.brandId);
    expect(stored).toBeInstanceOf(Menu);
    expect(stored?.id).toBe(menu.id);
    expect(stored?.tenantId).toBe(menu.tenantId);
    expect(stored?.brandId).toBe(menu.brandId);
    expect(stored?.products).toEqual(menu.products);
    expect(stored?.combos).toEqual(menu.combos);
    expect(
      stored?.quote({
        venueId: SITE_S,
        productId: BURGER_ID,
        modifierIds: [CHEESE_ID],
      }),
    ).toBe(25_000);
    expect(
      stored?.viewAt({ venueId: SITE_S, minute: "12:00" }).products[0]
        ?.orderable,
    ).toBe(false);
    expect(
      stored?.viewAt({ venueId: SITE_S, minute: "08:00" }).products[0]
        ?.orderable,
    ).toBe(true);
  });

  it("given tenants A and B, when tenant A loads its menu, then B stays hidden", async () => {
    const repository = await createRepository();
    const menuA = publishedMenu(TENANT_A, "menu_brand_a", PRODUCT_A);
    const menuB = publishedMenu(TENANT_B, "menu_brand_b", PRODUCT_B);

    await repository.save(menuA);
    await repository.save(menuB);

    const loadedA = await repository.load(TENANT_A, BRAND_ID);
    const loadedB = await repository.load(TENANT_B, BRAND_ID);
    expect(loadedA).toBeInstanceOf(Menu);
    expect(loadedB).toBeInstanceOf(Menu);
    expect(loadedA?.products.map((product) => product.id)).toEqual([PRODUCT_A]);
    expect(loadedA?.products.map((product) => product.id)).not.toContain(
      PRODUCT_B,
    );
    expect(loadedB?.products.map((product) => product.id)).toEqual([PRODUCT_B]);
    expect(loadedB?.products.map((product) => product.id)).not.toContain(
      PRODUCT_A,
    );
    expect(
      await repository.load(TENANT_B, "organization_brand_other"),
    ).toBeNull();
  });
}
