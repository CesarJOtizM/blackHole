import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FloorScreen } from "#src/orders/floor-screen.js";
import { ServiceProvider } from "#src/service/service-session.js";
import { readStationQueue, readTableMap } from "#src/service/venue-cloud.js";

it("given a cloud table in check, when the map is read, then the floor state is check", () => {
  expect(
    readTableMap({
      zones: [
        {
          zone: "salon",
          tables: [{ id: "table_12", state: "check_requested", diners: 3 }],
        },
      ],
    }),
  ).toEqual([
    {
      id: "table_12",
      label: "table_12",
      seats: 3,
      state: "check",
      lines: [],
    },
  ]);
});

it("given a sent line, when the station queue is read, then the ticket keeps the check and the line", () => {
  const tickets = readStationQueue({
    stationId: "station_parrilla",
    lines: [
      {
        checkId: "check_1",
        tableId: "table_12",
        lineId: "line_1",
        productId: "menu_product_soup",
        name: "Sopa",
        sentAt: new Date().toISOString(),
        state: "sent",
        channel: "qr_table",
        color: "red",
      },
    ],
  });

  expect(tickets?.[0]?.checkId).toBe("check_1");
  expect(tickets?.[0]?.lineId).toBe("line_1");
  expect(tickets?.[0]?.channel).toBe("qr_table");
  expect(tickets?.[0]?.ready).toBe(false);
});

it("given a cloud table map, when the floor opens, then the sample tables are replaced", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/table-map")) {
        return Response.json({
          zones: [
            {
              zone: "salon",
              tables: [{ id: "table_12", state: "occupied", diners: 2 }],
            },
          ],
        });
      }

      return new Response(null, { status: 404 });
    }),
  );
  render(
    <ServiceProvider>
      <FloorScreen />
    </ServiceProvider>,
  );

  expect(await screen.findByText("table_12")).toBeTruthy();
  expect(screen.queryByText("01")).toBeNull();
  vi.unstubAllGlobals();
});
