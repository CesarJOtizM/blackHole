import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PurchaseScreen } from "#src/inventory/inventory-screen.js";

const receiptWithAverage = {
  receiptId: "receipt-admin",
  locationId: "point-1",
  purchaseOrderId: "oc-0418",
  lines: [
    {
      ingredientId: "tomato",
      purchaseQuantity: 5,
      purchaseUnitCost: 4000,
      factor: 1000,
      quantity: 5000,
      unitCost: 4,
      averageCost: 4,
    },
  ],
};

const receiptWithoutAverage = {
  receiptId: "receipt-admin",
  locationId: "point-1",
  purchaseOrderId: "oc-0418",
  lines: [
    {
      ingredientId: "tomato",
      purchaseQuantity: 5,
      purchaseUnitCost: 4000,
      factor: 1000,
      quantity: 5000,
      unitCost: 4,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function fillReceipt() {
  fireEvent.change(screen.getByLabelText("Ubicación"), {
    target: { value: "point-1" },
  });
  fireEvent.change(screen.getByLabelText("Insumo"), {
    target: { value: "tomato" },
  });
  fireEvent.change(screen.getByLabelText("Cantidad"), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByLabelText("Costo unitario"), {
    target: { value: "4000" },
  });
}

it("given the purchase screen, when it is shown, then there is no invoice photo, invoice price, or WhatsApp", () => {
  render(<PurchaseScreen />);

  expect(screen.queryByRole("button", { name: /whatsapp/i })).toBeNull();
  expect(screen.queryByText(/foto/i)).toBeNull();
  expect(screen.queryByText(/precio factura/i)).toBeNull();
  expect(screen.queryByText(/precio pactado/i)).toBeNull();
});

it("given a purchase receipt, when it is confirmed, then the cloud receives the receipt without a photo, an invoice price, or WhatsApp", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => receiptWithAverage,
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<PurchaseScreen />);
  fillReceipt();
  fireEvent.click(screen.getByRole("button", { name: "Registrar recepción" }));

  expect(await screen.findByText("Recepción registrada.")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];
  const body = JSON.parse(init.body ?? "") as Record<string, unknown>;

  expect(url).toBe("/tenants/pilot/purchase-receipts");
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(init.headers?.["content-type"]).toBe("application/json");
  expect(body.receiptId).toEqual(expect.any(String));
  expect(String(body.receiptId).length).toBeGreaterThan(0);
  expect(body.locationId).toBe("point-1");
  expect(body.purchaseOrderId).toBe("oc-0418");
  expect(body.lines).toEqual([
    {
      ingredientId: "tomato",
      purchaseQuantity: 5,
      purchaseUnitCost: 4000,
    },
  ]);
  expect(body).not.toHaveProperty("supportDocument");
  expect(body).not.toHaveProperty("vat");
  expect(JSON.stringify(body)).not.toMatch(/whatsapp|foto|precio/i);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a receipt response with average cost, when it is shown, then the average is visible", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => receiptWithAverage,
    }),
  );
  render(<PurchaseScreen />);
  fillReceipt();
  fireEvent.click(screen.getByRole("button", { name: "Registrar recepción" }));

  expect(await screen.findByText("Costo promedio 4")).toBeTruthy();
});

it("given a receipt response without average cost, when it is shown, then the average stays hidden", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => receiptWithoutAverage,
    }),
  );
  render(<PurchaseScreen />);
  fillReceipt();
  fireEvent.click(screen.getByRole("button", { name: "Registrar recepción" }));

  expect(await screen.findByText("Recepción registrada.")).toBeTruthy();
  expect(screen.queryByText(/Costo promedio/)).toBeNull();
});

it("given the cloud is offline, when a receipt is attempted, then it is not stored on this screen", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<PurchaseScreen />);
  fillReceipt();
  fireEvent.click(screen.getByRole("button", { name: "Registrar recepción" }));

  expect(
    await screen.findByText(
      "No se puede registrar hasta que vuelva la conexión.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Costo promedio/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
