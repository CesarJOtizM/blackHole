import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductionScreen } from "#src/inventory/inventory-screen.js";

const runWithVariance = {
  runId: "run-admin",
  locationId: "point-1",
  recipeId: "sauce",
  expectedQuantity: 5000,
  actualQuantity: 4600,
  variance: -400,
  outputUnitCost: 6,
};

const runWithoutVariance = {
  runId: "run-admin",
  locationId: "point-1",
  recipeId: "sauce",
  expectedQuantity: 5000,
  actualQuantity: 4600,
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function fillRun() {
  fireEvent.change(screen.getByLabelText("Ubicación"), {
    target: { value: "point-1" },
  });
  fireEvent.change(screen.getByLabelText("Receta"), {
    target: { value: "sauce" },
  });
  fireEvent.change(screen.getByLabelText("Cantidad esperada"), {
    target: { value: "5000" },
  });
  fireEvent.change(screen.getByLabelText("Cantidad real"), {
    target: { value: "4600" },
  });
}

function fillPolicy(rule: "consumed_average" | "standard") {
  fireEvent.change(screen.getByLabelText("Regla"), {
    target: { value: rule },
  });

  if (rule === "standard") {
    fireEvent.change(screen.getByLabelText("Preparación"), {
      target: { value: "sauce" },
    });
    fireEvent.change(screen.getByLabelText("Costo estándar"), {
      target: { value: "5" },
    });
  }
}

it("given a production run, when it is confirmed, then the cloud receives the run and nothing is stored on this screen", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => runWithVariance,
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ProductionScreen />);
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(await screen.findByText("Producción registrada.")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];
  const body = JSON.parse(init.body ?? "") as Record<string, unknown>;

  expect(url).toBe("/tenants/pilot/production-runs");
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(init.headers?.["content-type"]).toBe("application/json");
  expect(body.runId).toEqual(expect.any(String));
  expect(String(body.runId).length).toBeGreaterThan(0);
  expect(body.locationId).toBe("point-1");
  expect(body.recipeId).toBe("sauce");
  expect(body.expectedQuantity).toBe(5000);
  expect(body.actualQuantity).toBe(4600);
  expect(body).not.toHaveProperty("variance");
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a run response with variance, when it is shown, then the variance is visible", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => runWithVariance,
    }),
  );
  render(<ProductionScreen />);
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(await screen.findByText("Variación -400")).toBeTruthy();
});

it("given a run response without variance, when it is shown, then the variance stays hidden", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => runWithoutVariance,
    }),
  );
  render(<ProductionScreen />);
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(await screen.findByText("Producción registrada.")).toBeTruthy();
  expect(screen.queryByText(/Variación/)).toBeNull();
});

it("given a consumed-average policy, when it is saved, then the cloud receives the policy", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      costRule: "consumed_average",
      preparations: [],
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ProductionScreen />);
  fillPolicy("consumed_average");
  fireEvent.click(screen.getByRole("button", { name: "Guardar política" }));

  expect(await screen.findByText("Política guardada.")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledOnce();
  const [url, init] = fetchMock.mock.calls[0] as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];

  expect(url).toBe("/tenants/pilot/venues/chapinero/production-cost-policy");
  expect(init.method).toBe("PUT");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(JSON.parse(init.body ?? "")).toEqual({
    costRule: "consumed_average",
    preparations: [],
  });
  expect(screen.queryByText(/Variación/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a standard policy, when it is saved, then the preparation cost is sent", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      costRule: "standard",
      preparations: [{ recipeId: "sauce", standardUnitCost: 5 }],
    }),
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ProductionScreen />);
  fillPolicy("standard");
  fireEvent.click(screen.getByRole("button", { name: "Guardar política" }));

  expect(await screen.findByText("Política guardada.")).toBeTruthy();
  const [, init] = fetchMock.mock.calls[0] as [string, { body?: string }];

  expect(JSON.parse(init.body ?? "")).toEqual({
    costRule: "standard",
    preparations: [{ recipeId: "sauce", standardUnitCost: 5 }],
  });
});

it("given the cloud is offline, when a run is attempted, then it is not stored on this screen", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<ProductionScreen />);
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(
    await screen.findByText(
      "No se puede registrar hasta que vuelva la conexión.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Variación/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
