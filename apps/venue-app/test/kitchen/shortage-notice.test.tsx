import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { KitchenScreen } from "#src/kitchen/kitchen-screen.js";
import { ServiceProvider } from "#src/service/service-session.js";

const redNotice = {
  alertId: "alert-beef",
  kind: "level",
  severity: "red",
  role: "siteAdministrator",
  venueId: "chapinero",
};

const coverageNotice = {
  alertId: "alert-friday",
  kind: "coverage",
  severity: "yellow",
  role: "siteAdministrator",
  venueId: "chapinero",
};

const otherVenueNotice = {
  alertId: "alert-other",
  kind: "level",
  severity: "critical",
  role: "generalManager",
  venueId: "usaquen",
};

const runWithVariance = {
  runId: "run-venue",
  locationId: "point-1",
  recipeId: "sauce",
  expectedQuantity: 5000,
  actualQuantity: 4600,
  variance: -400,
  outputUnitCost: 6,
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

function streamOf(frames: string) {
  const encoded = new TextEncoder().encode(frames);
  let sent = false;

  return {
    getReader() {
      return {
        read: async () => {
          if (sent) {
            return { done: true, value: undefined };
          }

          sent = true;

          return { done: false, value: encoded };
        },
      };
    },
  };
}

function noticeFrame(notice: {
  alertId: string;
  kind: string;
  severity: string;
  role: string;
  venueId: string;
}) {
  return `event: ${notice.kind}\ndata: ${JSON.stringify(notice)}\n\n`;
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

it("given a red level notice, when the kitchen opens, then the notice and one tap are shown", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/shortage-realtime")) {
        return {
          ok: true,
          status: 200,
          body: streamOf(noticeFrame(redNotice)),
        };
      }

      return { ok: false, status: 404, body: null, json: async () => ({}) };
    }),
  );
  renderKitchen();

  expect(
    await screen.findByRole("heading", { name: "Alerta de faltante" }),
  ).toBeTruthy();
  expect(screen.getByText("Alerta roja")).toBeTruthy();
  expect(screen.getByText("Nivel")).toBeTruthy();
  expect(screen.getByText("alert-beef")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reponer" })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Registrar producción" }),
  ).toBeTruthy();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a notice for another venue, when the kitchen reads the stream, then that notice stays hidden", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      body: streamOf(
        `${noticeFrame(otherVenueNotice)}${noticeFrame(redNotice)}`,
      ),
    })),
  );
  renderKitchen();

  expect(await screen.findByText("alert-beef")).toBeTruthy();
  expect(screen.queryByText("alert-other")).toBeNull();
  expect(screen.queryByText("Alerta crítica")).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a red level notice, when the kitchen taps restock, then the cloud receives one restock and no local stock", async () => {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/shortage-realtime")) {
        return {
          ok: true,
          status: 200,
          body: streamOf(noticeFrame(redNotice)),
        };
      }

      if (url.endsWith("/restock-facts")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            purchaseUnit: 1000,
            warehouseIds: ["warehouse_general"],
          }),
        };
      }

      if (url.endsWith("/restock")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            outcome: "transfer",
            documentId: "transfer-beef",
            quantity: 16,
          }),
        };
      }

      return { ok: false, status: 404, body: null, json: async () => ({}) };
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  renderKitchen();
  fireEvent.click(await screen.findByRole("button", { name: "Reponer" }));

  expect(await screen.findByText("Reposición registrada.")).toBeTruthy();
  const restock = fetchMock.mock.calls.find((call) =>
    String(call[0]).endsWith("/restock"),
  );

  expect(restock).toBeTruthy();
  const [url, init] = restock as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];
  const body = JSON.parse(init.body ?? "") as Record<string, unknown>;

  expect(url).toBe(
    "/tenants/pilot/venues/chapinero/shortage-alerts/alert-beef/restock",
  );
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(init.headers?.["content-type"]).toBe("application/json");
  expect(body.purchaseUnit).toBe(1000);
  expect(body.warehouseId).toBe("warehouse_general");
  expect(body.supplierId).toBeNull();
  expect(body.documentId).toEqual(expect.any(String));
  expect(String(body.documentId).length).toBeGreaterThan(0);
  expect(body.lineId).toEqual(expect.any(String));
  expect(String(body.lineId).length).toBeGreaterThan(0);
  expect(body).not.toHaveProperty("quantity");
  expect(
    fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/restock")),
  ).toHaveLength(1);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a coverage notice without a supplying warehouse, when restock is tapped, then a purchase order is offered", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/shortage-realtime")) {
        return {
          ok: true,
          status: 200,
          body: streamOf(noticeFrame(coverageNotice)),
        };
      }

      if (url.endsWith("/restock")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            outcome: "purchase-order",
            documentId: "po-friday",
            quantity: 16,
          }),
        };
      }

      return { ok: false, status: 404, body: null, json: async () => ({}) };
    }),
  );
  renderKitchen();

  expect(await screen.findByText("Cobertura")).toBeTruthy();
  expect(screen.getByText("Alerta amarilla")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reponer" }));

  expect(
    await screen.findByText("Se ofreció una orden de compra."),
  ).toBeTruthy();
  expect(screen.queryByText("Reposición registrada.")).toBeNull();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given the shortage flag is off, when the kitchen opens, then no notice and no restock are shown", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: false,
    status: 404,
    body: null,
    json: async () => ({}),
  }));
  vi.stubGlobal("fetch", fetchMock);
  renderKitchen();

  expect(await screen.findByRole("heading", { name: "Cocina" })).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Alerta de faltante" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Reponer" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Registrar producción" }),
  ).toBeTruthy();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a kitchen production run, when a shortage notice is also open, then the production post stays and stock is not written locally", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/shortage-realtime")) {
      return {
        ok: true,
        status: 200,
        body: streamOf(noticeFrame(redNotice)),
      };
    }

    if (url.endsWith("/production-runs")) {
      return { ok: true, status: 200, json: async () => runWithVariance };
    }

    return { ok: false, status: 404, body: null, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  renderKitchen();
  expect(await screen.findByText("alert-beef")).toBeTruthy();
  fillRun();
  fireEvent.click(screen.getByRole("button", { name: "Registrar producción" }));

  expect(await screen.findByText("Producción registrada.")).toBeTruthy();
  const production = fetchMock.mock.calls.find((call) =>
    String(call[0]).endsWith("/production-runs"),
  );

  expect(production).toBeTruthy();
  const [url, init] = production as [
    string,
    { method?: string; body?: string },
  ];

  expect(url).toBe("/tenants/pilot/production-runs");
  expect(init.method).toBe("POST");
  expect(
    fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/restock")),
  ).toHaveLength(0);
  expect(
    fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/stock-levels"),
    ),
  ).toHaveLength(0);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
