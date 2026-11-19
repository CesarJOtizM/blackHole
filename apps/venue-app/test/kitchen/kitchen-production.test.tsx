import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { KitchenScreen } from "#src/kitchen/kitchen-screen.js";
import { ServiceProvider } from "#src/service/service-session.js";

const runWithVariance = {
  runId: "run-venue",
  locationId: "point-1",
  recipeId: "sauce",
  expectedQuantity: 5000,
  actualQuantity: 4600,
  variance: -400,
  outputUnitCost: 6,
};

const runWithoutVariance = {
  runId: "run-venue",
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

function renderKitchen() {
  render(
    <ServiceProvider>
      <KitchenScreen />
    </ServiceProvider>,
  );
}

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

function productionCall(
  fetchMock: ReturnType<typeof vi.fn>,
): [
  string,
  { method?: string; body?: string; headers?: Record<string, string> },
] {
  const call = fetchMock.mock.calls.find((entry) =>
    String(entry[0]).endsWith("/production-runs"),
  );

  expect(call).toBeTruthy();

  return call as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];
}

it("given the kitchen screen, when it is shown, then tickets stay and there is no local production run", () => {
  renderKitchen();

  expect(screen.getByRole("heading", { name: "Cocina" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Listo" })).toHaveLength(2);
  expect(
    screen.getByRole("button", { name: "Registrar producción" }),
  ).toBeTruthy();
  expect(screen.queryByText(/Variación/)).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a production run, when the kitchen confirms it, then the same cloud post is sent and nothing is stored locally", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/production-runs")) {
      return { ok: true, json: async () => runWithVariance };
    }

    return { ok: false, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  renderKitchen();
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(await screen.findByText("Producción registrada.")).toBeTruthy();
  const [url, init] = productionCall(fetchMock);
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
  expect(screen.getAllByRole("button", { name: "Listo" })).toHaveLength(2);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a run response with variance, when the kitchen shows it, then the variance is visible", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/production-runs")) {
        return { ok: true, json: async () => runWithVariance };
      }

      return { ok: false, json: async () => ({}) };
    }),
  );
  renderKitchen();
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(await screen.findByText("Variación -400")).toBeTruthy();
});

it("given a run response without variance, when the kitchen shows it, then the variance stays hidden", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/production-runs")) {
        return { ok: true, json: async () => runWithoutVariance };
      }

      return { ok: false, json: async () => ({}) };
    }),
  );
  renderKitchen();
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(await screen.findByText("Producción registrada.")).toBeTruthy();
  expect(screen.queryByText(/Variación/)).toBeNull();
});

it("given the cloud is offline, when the kitchen attempts a run, then it is not stored on this screen", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  renderKitchen();
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(
    await screen.findByText(
      "No se puede registrar hasta que vuelva la conexión.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/Variación/)).toBeNull();
  expect(screen.getAllByRole("button", { name: "Listo" })).toHaveLength(2);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
