import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { router } from "#src/router.js";
import { StockCountScreen } from "#src/stock-counts/count-screen.js";

const theoreticalQuantity = 8_000_000;
const averageCost = 3000;
const variance = -1_000_000;

afterEach(() => {
  vi.unstubAllGlobals();
});

function fillSheet() {
  fireEvent.change(screen.getByLabelText("Ubicación"), {
    target: { value: "point-1" },
  });
  fireEvent.change(screen.getByLabelText("Corte"), {
    target: { value: "2026-11-13T18:00:00.000Z" },
  });
  fireEvent.change(screen.getByLabelText("Documento"), {
    target: { value: "count-1" },
  });
}

it("given the venue routes, when stock counts are registered, then the count screen is that route", () => {
  expect(router.routesByPath["/stock-count"]?.options.path).toBe("stock-count");
});

it("given a sheet that also carries the theoretical quantity, when the count opens, then only the ingredient and an empty quantity are shown", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ingredientIds: ["beef"],
        onHand: theoreticalQuantity,
        averageCost,
        theoretical: theoreticalQuantity,
      }),
    }),
  );
  render(<StockCountScreen />);
  fillSheet();
  fireEvent.click(screen.getByRole("button", { name: "Abrir conteo" }));

  expect(await screen.findByLabelText("beef")).toBeTruthy();
  expect(screen.getByLabelText("beef")).toHaveProperty("value", "");
  expect(screen.queryByText(String(theoreticalQuantity))).toBeNull();
  expect(screen.queryByText(String(averageCost))).toBeNull();
  expect(screen.queryByText(/teóric/i)).toBeNull();
});

it("given a submitted count, when the freeze comes back, then the difference is shown", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ingredientIds: ["beef"] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        posted: true,
        valueCop: averageCost,
        lines: [
          {
            ingredientId: "beef",
            quantity: variance,
            valueCop: averageCost,
            averageCost,
          },
        ],
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  render(<StockCountScreen />);
  fillSheet();
  fireEvent.click(screen.getByRole("button", { name: "Abrir conteo" }));
  fireEvent.change(await screen.findByLabelText("beef"), {
    target: { value: "7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar conteo" }));

  expect(await screen.findByText(`Diferencia beef ${variance}`)).toBeTruthy();
  expect(screen.queryByText(String(averageCost))).toBeNull();
  const posted = fetchMock.mock.calls[1] as [string, { body: string }];
  expect(JSON.parse(posted[1].body)).toEqual({
    locationId: "point-1",
    documentId: "count-1",
    cutOff: "2026-11-13T18:00:00.000Z",
    scope: "full",
    lines: [{ ingredientId: "beef", purchaseQuantity: 7 }],
  });
});
