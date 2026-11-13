import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BillingDataScreen } from "#src/billing-data-screen.js";
import { TableOrderScreen } from "#src/table-order/table-order-screen.js";
import { TablePaymentScreen } from "#src/table-payment/table-payment-screen.js";

it("given a published menu, when the table opens, then that menu replaces the sample", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/m/table-token") {
        return Response.json({
          products: [
            {
              id: "menu_product_arepa",
              name: "Arepa",
              price: 9000,
              orderable: true,
            },
          ],
        });
      }

      return new Response(null, { status: 404 });
    }),
  );
  render(<TableOrderScreen token="table-token" />);

  expect(await screen.findByText("Arepa")).toBeTruthy();
  expect(screen.queryByText("Sopa")).toBeNull();
  vi.unstubAllGlobals();
});

it("given a balance and no split, when the customer pays the bill, then the portal posts the payment", () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 202 })),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(
    <TablePaymentScreen
      token="pre-bill-token"
      balanceCop={85_000}
      parts={[]}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Pagar la cuenta" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/d/pre-bill-token/payments",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ tipCop: 0 }),
    }),
  );
  vi.unstubAllGlobals();
});

it("given a document number, when the customer sends billing data, then the portal looks up the buyer", () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(Response.json({ outcome: "missing" })),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<BillingDataScreen token="pre-bill-token" />);

  fireEvent.change(screen.getByLabelText("Cédula"), {
    target: { value: "123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar datos" }));

  expect(fetchMock).toHaveBeenCalledWith(
    "/portal/buyers",
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"documentNumber":"123"'),
    }),
  );
  expect(screen.getByRole("status").textContent).toMatch(/datos enviados/i);
  vi.unstubAllGlobals();
});
