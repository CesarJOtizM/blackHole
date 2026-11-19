import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RegisterScreen } from "#src/cash-register/register-screen.js";
import { ServiceProvider } from "#src/service/service-session.js";

const redNotice = {
  alertId: "alert-beef",
  kind: "level",
  severity: "red",
  role: "siteAdministrator",
  venueId: "chapinero",
};

const dishNotice = {
  alertId: "alert-dish",
  kind: "dish",
  severity: "critical",
  role: "siteAdministrator",
  venueId: "chapinero",
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function renderRegister() {
  render(
    <ServiceProvider>
      <RegisterScreen />
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

it("given a red level notice, when the cash register opens, then the notice and one tap are shown", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(
        "/tenants/pilot/venues/chapinero/shortage-realtime",
      );
      expect(init?.method).toBe("GET");
      const headers = init?.headers as Record<string, string>;

      expect(headers.accept).toBe("text/event-stream");
      expect(headers["x-session-id"]).toBe("admin-web");

      return {
        ok: true,
        status: 200,
        body: streamOf(noticeFrame(redNotice)),
      };
    }),
  );
  renderRegister();

  expect(
    await screen.findByRole("heading", { name: "Alerta de faltante" }),
  ).toBeTruthy();
  expect(screen.getByText("Alerta roja")).toBeTruthy();
  expect(screen.getByText("alert-beef")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reponer" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Turno de caja" })).toBeTruthy();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given a dish notice, when the cashier taps restock, then the cloud receives one restock and no local stock", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/shortage-realtime")) {
      return {
        ok: true,
        status: 200,
        body: streamOf(noticeFrame(dishNotice)),
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
          documentId: "transfer-dish",
          quantity: 4,
        }),
      };
    }

    return { ok: false, status: 404, body: null, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  renderRegister();

  expect(await screen.findByText("Plato")).toBeTruthy();
  expect(screen.getByText("Alerta crítica")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reponer" }));

  expect(await screen.findByText("Reposición registrada.")).toBeTruthy();
  const restock = fetchMock.mock.calls.find((call) =>
    String(call[0]).endsWith("/restock"),
  );
  const [url, init] = restock as [
    string,
    { method?: string; body?: string; headers?: Record<string, string> },
  ];
  const body = JSON.parse(init.body ?? "") as Record<string, unknown>;

  expect(url).toBe(
    "/tenants/pilot/venues/chapinero/shortage-alerts/alert-dish/restock",
  );
  expect(init.method).toBe("POST");
  expect(init.headers?.["x-session-id"]).toBe("admin-web");
  expect(body.purchaseUnit).toBe(1000);
  expect(body.warehouseId).toBe("warehouse_general");
  expect(body.supplierId).toBeNull();
  expect(body).not.toHaveProperty("quantity");
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

it("given the shortage flag is off, when the cash register opens, then no notice is shown", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status: 404,
      body: null,
      json: async () => ({}),
    })),
  );
  renderRegister();

  expect(
    await screen.findByRole("heading", { name: "Turno de caja" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Alerta de faltante" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Reponer" })).toBeNull();
  expect(screen.getByRole("button", { name: "Abrir turno" })).toBeTruthy();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
