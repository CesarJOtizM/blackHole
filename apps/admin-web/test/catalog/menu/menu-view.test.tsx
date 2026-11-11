import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MenuView } from "#src/catalog/menu/menu-view.js";
import type { MenuProduct } from "#src/catalog/source/types.js";

const churrasco: MenuProduct = {
  id: "churrasco",
  brandId: "la-parrilla",
  categoryId: "cuts",
  name: "Churrasco 400 g",
  price: 44000,
  tax: "INC 8%",
  station: "Parrilla",
  modifierCount: 3,
  status: "on-menu",
};

describe("MenuView", () => {
  it("Given the cuts category, When rendered, Then the product name is visible", () => {
    renderMenu();

    expect(
      screen.getByRole("button", { name: "Churrasco 400 g" }),
    ).toBeTruthy();
  });

  it("Given another category, When it is chosen, Then the screen receives that category", () => {
    const onCategory = vi.fn();
    renderMenu(onCategory);

    fireEvent.click(screen.getByRole("button", { name: /Bebidas/ }));

    expect(onCategory).toHaveBeenCalledWith("drinks");
  });
});

function renderMenu(onCategory = vi.fn()) {
  render(
    <MenuView
      brandLabel="La Parrilla"
      productCount={9}
      section="products"
      brandId="la-parrilla"
      brands={[{ id: "la-parrilla", label: "La Parrilla" }]}
      categoryId="cuts"
      categories={[
        { id: "cuts", name: "Cortes", productCount: 4 },
        { id: "drinks", name: "Bebidas", productCount: 1 },
      ]}
      products={[churrasco]}
      productsPending={false}
      productsError={false}
      categoryName="Cortes"
      groups={[]}
      importPending={false}
      importDone={false}
      createPending={false}
      onBrand={vi.fn()}
      onSection={vi.fn()}
      onCategory={onCategory}
      onImport={vi.fn()}
      onCreate={vi.fn()}
      onOpenProduct={vi.fn()}
    />,
  );
}
