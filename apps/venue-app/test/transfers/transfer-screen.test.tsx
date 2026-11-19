import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { router } from "#src/router.js";
import { TransferScreen } from "#src/transfers/transfer-screen.js";

const requested = {
  transferId: "transfer-venue",
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

it("given the venue routes, when transfers are registered, then the transfer screen is that route", () => {
  expect(router.routesByPath["/transfers"]?.options.path).toBe("transfers");
});

it("given the transfer screen, when it is shown, then receipt stays on the cloud", () => {
  render(<TransferScreen />);

  expect(screen.getByRole("heading", { name: "Traslados" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Solicitar traslado" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Despachar" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Recibir por QR" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /local/i })).toBeNull();
  expect(screen.queryByLabelText("Costo unitario")).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a replenishment request, when the venue confirms it, then the same cloud post is sent and nothing is stored locally", async () => {
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
  expect(screen.queryByText(/Costo unitario/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a dispatch response with unit cost, when the venue shows it, then the cost is visible", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => dispatchedWithCost,
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<TransferScreen />);
  fillDispatch();
  fireEvent.click(screen.getByRole("button", { name: "Despachar" }));

  expect(await screen.findByText("Costo unitario 12")).toBeTruthy();
  const { url, body } = postedBody(fetchMock);

  expect(url).toBe("/tenants/pilot/transfers/t-0112/dispatch");
  expect(body).toEqual({ actorId: "user-1", deviceId: "device-1" });
  expect(body).not.toHaveProperty("vat");
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a dispatch response without unit cost, when the venue shows it, then the cost stays hidden", async () => {
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

it("given a QR voucher, when the venue confirms the receipt, then the same cloud post is sent and nothing is stored locally", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      transferId: "t-0112",
      originLocationId: "warehouse-1",
      destinationLocationId: "point-1",
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
  const { url, init, body } = postedBody(fetchMock);

  expect(url).toBe("/tenants/pilot/transfers/t-0112/receipt");
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(body).toEqual({
    lines: [{ ingredientId: "beef", receivedQuantity: 900 }],
    authorizerId: "authorizer-1",
  });
  expect(body).not.toHaveProperty("vat");
  expect(screen.queryByText(/Costo unitario/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a short QR receipt without an authorizer, when the cloud rejects it, then the venue stores nothing", async () => {
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

  expect(body).not.toHaveProperty("authorizerId");
  expect(screen.queryByText(/Costo unitario/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given the cloud is offline, when a venue transfer is attempted, then it is not stored on this screen", async () => {
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
