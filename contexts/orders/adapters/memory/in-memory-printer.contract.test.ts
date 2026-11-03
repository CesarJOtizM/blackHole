import { expect, it } from "vitest";

import { InMemoryPrinter } from "#adapters/memory/in-memory-printer.js";
import type { KitchenTicketJob } from "#application/ports/printer.js";

const JOB: KitchenTicketJob = {
  document: "kitchen_ticket",
  commandId: "kitchen_ticket:check_5:line_soup",
  stationId: "station_grill",
  station: "Grill",
  table: "table_5",
  lines: [{ quantity: "1", name: "Jalapeño" }],
  kickDrawer: false,
};

it("given a kitchen ticket, when it is enqueued, then the job is recorded with no kick and no ESC/POS", async () => {
  const printer = new InMemoryPrinter();

  const queued = await printer.enqueue(JOB);

  const recorded = JSON.stringify(printer.jobs);
  const encoded = new TextEncoder().encode(recorded);
  expect(queued).toEqual({ status: "waiting", kickDrawer: false });
  expect(printer.jobs).toEqual([JOB]);
  expect(encoded.includes(0x1b)).toBe(false);
  expect(encoded.includes(0x1d)).toBe(false);
});

it("given a printer set to fail, when a ticket is enqueued, then the job is failed and still recorded", async () => {
  const printer = new InMemoryPrinter();
  printer.fail = true;

  const queued = await printer.enqueue(JOB);

  expect(queued).toEqual({ status: "failed", kickDrawer: false });
  expect(printer.jobs).toEqual([JOB]);
});
