import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { router } from "#src/router.js";
import {
  presentTableOrderMenu,
  TableOrderScreen,
} from "#src/table-order/table-order-screen.js";

it("given a site price and a sold-out dish, when the table menu is presented, then the site price is shown and the sold-out dish cannot be ordered", () => {
  const menu = presentTableOrderMenu([
    { id: "menu_product_soup", name: "Sopa", price: 22_000, orderable: true },
    {
      id: "menu_product_steak",
      name: "Churrasco",
      price: 48_000,
      orderable: false,
    },
  ]);

  expect(menu).toEqual([
    {
      id: "menu_product_soup",
      name: "Sopa",
      priceLabel: "$22.000",
      orderable: true,
    },
    {
      id: "menu_product_steak",
      name: "Churrasco",
      priceLabel: "$48.000",
      orderable: false,
    },
  ]);
});

it("given a table token, when /m/:token is shown, then the customer can send the order and cannot pay", () => {
  const paths = Object.keys(router.routesByPath);

  expect(paths).toContain("/m/$token");
  expect(paths).toContain("/d/$token");
  expect(paths).toContain("/f/$link");
  render(<TableOrderScreen token="table-qr-nonce-0001" />);

  expect(screen.getByText("$22.000")).toBeTruthy();
  expect(screen.getByText("Agotado")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Enviar pedido" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /pagar/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /pay/i })).toBeNull();
});

it("given a dish in the cart, when the customer sends the order, then the portal posts the intent", () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 202 })),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<TableOrderScreen token="table-qr-nonce-0001" />);

  fireEvent.click(screen.getByRole("button", { name: "Sumar" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/m/table-qr-nonce-0001/orders",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("menu_product_soup"),
    }),
  );
  vi.unstubAllGlobals();
});

it("given items that have not been sent, when the customer removes one, then the cart updates and nothing reaches the account", () => {
  render(<TableOrderScreen token="table-qr-nonce-0001" />);

  fireEvent.click(screen.getByRole("button", { name: "Sumar" }));
  expect(screen.getByRole("button", { name: "Quitar" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Quitar" }));

  expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: /anular|descuento|cortes[ií]a|precio/i,
    }),
  ).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Enviar pedido" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("given a pending QR order, when the cashier rejects it, then the portal shows it was not accepted", () => {
  const paths = Object.keys(router.routesByPath);

  expect(paths).toContain("/m/$token");
  render(
    <TableOrderScreen token="table-qr-nonce-0001" acceptance="rejected" />,
  );

  expect(screen.getByRole("status").textContent).toMatch(/no fue aceptado/i);
  expect(screen.queryByRole("button", { name: /pagar/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /pay/i })).toBeNull();
});
