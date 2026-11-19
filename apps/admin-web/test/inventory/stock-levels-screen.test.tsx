import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ProductionScreen,
  PurchaseScreen,
  StockLevelsScreen,
  TransferScreen,
} from "#src/inventory/inventory-screen.js";

const activeBeef = {
  tenantId: "pilot",
  venueId: "chapinero",
  ingredientId: "beef",
  maximum: 20,
  reorderPoint: 15,
  minimum: 8,
};

const acceptedBeef = {
  tenantId: "pilot",
  venueId: "chapinero",
  ingredientId: "beef",
  maximum: 30,
  reorderPoint: 18,
  minimum: 10,
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function fillLevels() {
  fireEvent.change(screen.getByLabelText("Insumo"), {
    target: { value: "beef" },
  });
  fireEvent.change(screen.getByLabelText("Máximo"), {
    target: { value: "20" },
  });
  fireEvent.change(screen.getByLabelText("Punto de reorden"), {
    target: { value: "15" },
  });
  fireEvent.change(screen.getByLabelText("Mínimo"), {
    target: { value: "8" },
  });
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

it("given the inventory screens, when they are shown, then purchase, production, and transfer stay", () => {
  const purchase = render(<PurchaseScreen />);

  expect(screen.getByRole("heading", { name: "Recepción" })).toBeTruthy();
  purchase.unmount();

  const production = render(<ProductionScreen />);

  expect(screen.getByRole("heading", { name: "Corrida" })).toBeTruthy();
  production.unmount();

  render(<TransferScreen />);

  expect(screen.getByRole("heading", { name: "Traslados" })).toBeTruthy();
});

it("given empty levels, when the administrator saves, then nothing is sent", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<StockLevelsScreen />);
  fireEvent.click(screen.getByRole("button", { name: "Guardar niveles" }));

  expect(screen.getByText("Revisa los niveles.")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given stock levels, when the administrator saves them, then the cloud stores maximum, reorder point, and minimum", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, activeBeef));
  vi.stubGlobal("fetch", fetchMock);
  render(<StockLevelsScreen />);
  fillLevels();
  fireEvent.click(screen.getByRole("button", { name: "Guardar niveles" }));

  expect(await screen.findByText("Niveles guardados.")).toBeTruthy();
  expect(screen.getByText("Insumo activo beef")).toBeTruthy();
  expect(screen.getByText("Máximo activo 20")).toBeTruthy();
  expect(screen.getByText("Punto de reorden activo 15")).toBeTruthy();
  expect(screen.getByText("Mínimo activo 8")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];
  const body = JSON.parse(init.body ?? "") as Record<string, unknown>;

  expect(url).toBe("/tenants/pilot/venues/chapinero/stock-levels");
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(init.headers?.["content-type"]).toBe("application/json");
  expect(body).toEqual({
    ingredientId: "beef",
    maximum: 20,
    reorderPoint: 15,
    minimum: 8,
  });
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given inconsistent levels, when the cloud rejects them, then the active levels stay unchanged", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(jsonResponse(400, { error: "InvalidStockLevels" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<StockLevelsScreen />);
  fillLevels();
  fireEvent.click(screen.getByRole("button", { name: "Guardar niveles" }));

  expect(
    await screen.findByText("Los niveles no quedaron guardados."),
  ).toBeTruthy();
  expect(screen.queryByText("Máximo activo 20")).toBeNull();
  expect(screen.queryByText("Niveles guardados.")).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a pending beef proposal, when it is not accepted, then the active levels stay in place", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, activeBeef));
  vi.stubGlobal("fetch", fetchMock);
  render(<StockLevelsScreen />);
  fillLevels();
  fireEvent.click(screen.getByRole("button", { name: "Guardar niveles" }));

  expect(await screen.findByText("Máximo activo 20")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Propuesta"), {
    target: { value: "beef-proposal" },
  });

  expect(screen.getByText("Máximo activo 20")).toBeTruthy();
  expect(screen.getByText("Punto de reorden activo 15")).toBeTruthy();
  expect(screen.queryByText("Propuesta aceptada.")).toBeNull();
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
    "/tenants/pilot/venues/chapinero/stock-levels",
  );
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given an empty proposal, when the administrator accepts it, then nothing is sent", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<StockLevelsScreen />);
  fireEvent.click(screen.getByRole("button", { name: "Aceptar propuesta" }));

  expect(screen.getByText("Revisa la propuesta.")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a beef proposal, when the administrator accepts it, then those levels become active", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, acceptedBeef));
  vi.stubGlobal("fetch", fetchMock);
  render(<StockLevelsScreen />);
  fireEvent.change(screen.getByLabelText("Propuesta"), {
    target: { value: "beef-proposal" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aceptar propuesta" }));

  expect(await screen.findByText("Propuesta aceptada.")).toBeTruthy();
  expect(screen.getByText("Insumo activo beef")).toBeTruthy();
  expect(screen.getByText("Máximo activo 30")).toBeTruthy();
  expect(screen.getByText("Punto de reorden activo 18")).toBeTruthy();
  expect(screen.getByText("Mínimo activo 10")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];

  expect(url).toBe(
    "/tenants/pilot/venues/chapinero/stock-level-suggestions/beef-proposal/acceptance",
  );
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(init.body).toBeUndefined();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given the shortage flag is off, when the administrator saves levels, then the route is absent and nothing is stored locally", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(jsonResponse(404, { error: "Not Found" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<StockLevelsScreen />);
  fillLevels();
  fireEvent.click(screen.getByRole("button", { name: "Guardar niveles" }));

  expect(
    await screen.findByText("La ruta de niveles no está disponible."),
  ).toBeTruthy();
  expect(screen.queryByText("Máximo activo 20")).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
