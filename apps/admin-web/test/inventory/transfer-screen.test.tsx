import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ProductionScreen,
  PurchaseScreen,
  TransferScreen,
} from "#src/inventory/inventory-screen.js";

const requested = {
  transferId: "transfer-admin",
  originLocationId: "warehouse-1",
  destinationLocationId: "point-1",
  status: "requested",
  lines: [{ ingredientId: "beef", quantity: 1000 }],
};

const dispatchedWithCost = {
  transferId: "t-0112",
  originLocationId: "warehouse-1",
  destinationLocationId: "point-1",
  status: "in_transit",
  lines: [{ ingredientId: "beef", quantity: 1000, unitCost: 12 }],
};

const dispatchedWithoutCost = {
  transferId: "t-0112",
  originLocationId: "warehouse-1",
  destinationLocationId: "point-1",
  status: "in_transit",
  lines: [{ ingredientId: "beef", quantity: 1000 }],
};

const receivedWithCost = {
  transferId: "t-0112",
  originLocationId: "warehouse-1",
  destinationLocationId: "point-1",
  status: "received",
  lines: [
    {
      ingredientId: "beef",
      quantity: 1000,
      unitCost: 12,
      receivedQuantity: 1000,
      shortfall: 0,
    },
  ],
};

const voucher = JSON.stringify({
  transferId: "t-0112",
  lines: [{ ingredientId: "beef", quantity: 1000 }],
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function fillRequest() {
  fireEvent.change(screen.getByLabelText("Origen"), {
    target: { value: "warehouse-1" },
  });
  fireEvent.change(screen.getByLabelText("Destino"), {
    target: { value: "point-1" },
  });
  fireEvent.change(screen.getByLabelText("Insumo"), {
    target: { value: "beef" },
  });
  fireEvent.change(screen.getByLabelText("Cantidad"), {
    target: { value: "1000" },
  });
}

function fillDispatch() {
  fireEvent.change(screen.getByLabelText("Traslado"), {
    target: { value: "t-0112" },
  });
  fireEvent.change(screen.getByLabelText("Actor"), {
    target: { value: "user-1" },
  });
  fireEvent.change(screen.getByLabelText("Dispositivo"), {
    target: { value: "device-1" },
  });
}

function fillReceipt(receivedQuantity: string, authorizer = "") {
  fireEvent.change(screen.getByLabelText("QR"), {
    target: { value: voucher },
  });
  fireEvent.change(screen.getByLabelText("Cantidad recibida"), {
    target: { value: receivedQuantity },
  });
  fireEvent.change(screen.getByLabelText("Autorizador"), {
    target: { value: authorizer },
  });
}

function postedBody(fetchMock: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];

  return {
    url,
    init,
    body: JSON.parse(init.body ?? "") as Record<string, unknown>,
  };
}

it("given the inventory screens, when transfers are added, then purchase and production stay", () => {
  expect(PurchaseScreen).toBeTypeOf("function");
  expect(ProductionScreen).toBeTypeOf("function");
  render(<TransferScreen />);

  expect(
    screen.getByRole("button", { name: "Solicitar traslado" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Despachar" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Recibir por QR" })).toBeTruthy();
  expect(screen.queryByLabelText("Costo unitario")).toBeNull();
});

it("given a replenishment request, when it is confirmed, then the cloud receives the transfer and nothing is stored on this screen", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => requested,
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TransferScreen />);
  fillRequest();
  fireEvent.click(screen.getByRole("button", { name: "Solicitar traslado" }));

  expect(await screen.findByText("Traslado solicitado.")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledOnce();
  const { url, init, body } = postedBody(fetchMock);

  expect(url).toBe("/tenants/pilot/transfers");
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(init.headers?.["content-type"]).toBe("application/json");
  expect(body.transferId).toEqual(expect.any(String));
  expect(String(body.transferId).length).toBeGreaterThan(0);
  expect(body.originLocationId).toBe("warehouse-1");
  expect(body.destinationLocationId).toBe("point-1");
  expect(body.lines).toEqual([{ ingredientId: "beef", quantity: 1000 }]);
  expect(body).not.toHaveProperty("vat");
  expect(body).not.toHaveProperty("unitCost");
  expect(body).not.toHaveProperty("actorId");
  expect(body).not.toHaveProperty("deviceId");
  expect(screen.queryByText(/Costo unitario/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a dispatch response with unit cost, when it is shown, then the cost is visible", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => dispatchedWithCost,
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TransferScreen />);
  fillDispatch();
  fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

  expect(await screen.findByText("Costo unitario 12")).toBeTruthy();
  expect(await screen.findByText("Traslado despachado.")).toBeTruthy();
  const { url, init, body } = postedBody(fetchMock);

  expect(url).toBe("/tenants/pilot/transfers/t-0112/dispatch");
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(body).toEqual({ actorId: "user-1", deviceId: "device-1" });
  expect(body).not.toHaveProperty("vat");
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a dispatch response without unit cost, when it is shown, then the cost stays hidden", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => dispatchedWithoutCost,
    }),
  );
  render(<TransferScreen />);
  fillDispatch();
  fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

  expect(await screen.findByText("Traslado despachado.")).toBeTruthy();
  expect(screen.queryByText(/Costo unitario/)).toBeNull();
});

it("given a QR voucher, when the receipt is confirmed, then the cloud receives it and nothing is stored on this screen", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => receivedWithCost,
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TransferScreen />);
  fillReceipt("1000");
  fireEvent.click(screen.getByRole("button", { name: "Recibir por QR" }));

  expect(await screen.findByText("Recepción registrada.")).toBeTruthy();
  expect(await screen.findByText("Costo unitario 12")).toBeTruthy();
  const { url, init, body } = postedBody(fetchMock);

  expect(url).toBe("/tenants/pilot/transfers/t-0112/receipt");
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(init.headers?.["content-type"]).toBe("application/json");
  expect(body).toEqual({
    lines: [{ ingredientId: "beef", receivedQuantity: 1000 }],
  });
  expect(body).not.toHaveProperty("vat");
  expect(body).not.toHaveProperty("authorizerId");
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a short QR receipt with an authorizer, when it is confirmed, then authorizerId is sent and a missing cost stays hidden", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      ...receivedWithCost,
      status: "received_with_differences",
      lines: [
        {
          ingredientId: "beef",
          quantity: 1000,
          receivedQuantity: 900,
          shortfall: 100,
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TransferScreen />);
  fillReceipt("900", "authorizer-1");
  fireEvent.click(screen.getByRole("button", { name: "Recibir por QR" }));

  expect(await screen.findByText("Recepción registrada.")).toBeTruthy();
  const { body } = postedBody(fetchMock);

  expect(body).toEqual({
    lines: [{ ingredientId: "beef", receivedQuantity: 900 }],
    authorizerId: "authorizer-1",
  });
  expect(screen.queryByText(/Costo unitario/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a short QR receipt without an authorizer, when the cloud rejects it, then nothing is stored and the cost stays hidden", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: "UnauthorizedTransferDifference" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TransferScreen />);
  fillReceipt("900");
  fireEvent.click(screen.getByRole("button", { name: "Recibir por QR" }));

  expect(
    await screen.findByText("La recepción no quedó registrada."),
  ).toBeTruthy();
  const { body } = postedBody(fetchMock);

  expect(body).toEqual({
    lines: [{ ingredientId: "beef", receivedQuantity: 900 }],
  });
  expect(body).not.toHaveProperty("authorizerId");
  expect(body).not.toHaveProperty("vat");
  expect(screen.queryByText(/Costo unitario/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given the cloud is offline, when a transfer is attempted, then it is not stored on this screen", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<TransferScreen />);
  fillRequest();
  fireEvent.click(screen.getByRole("button", { name: "Solicitar traslado" }));

  expect(
    await screen.findByText(
      "No se puede registrar hasta que vuelva la conexión.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Costo unitario/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
