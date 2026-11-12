import { expect, it } from "vitest";

import { InMemoryOperationFacts } from "#adapters/memory/in-memory-operation-facts.js";
import type {
  OperationSnapshot,
  ServiceLineFact,
} from "#application/ports/operation-facts.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const FROM = "2026-11-11T05:00:00.000Z";
const TO = "2026-11-12T05:00:00.000Z";
const INSIDE = "2026-11-11T18:00:00.000Z";
const OUTSIDE = "2026-11-10T12:00:00.000Z";

const query = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  from: FROM,
  to: TO,
};

const line = (lineId: string, chargedAt: string | null): ServiceLineFact => ({
  checkId: `check_${lineId}`,
  lineId,
  tableId: "table_1",
  productId: "product_arepa",
  productName: "Arepa",
  stationId: "station_grill",
  waiterId: "identity_waiter_1",
  channel: "waiter",
  quantity: 1,
  grossCop: 10_000,
  discountCop: 0,
  includedTaxCop: 0,
  tipCop: 0,
  voided: false,
  diners: 2,
  openedAt: chargedAt,
  sentAt: null,
  inPreparationAt: null,
  readyAt: null,
  deliveredAt: null,
  requestedAt: null,
  chargedAt,
  releasedAt: null,
});

const kept: OperationSnapshot = {
  lines: [line("line_kept", INSIDE)],
  tenders: [
    {
      checkId: "check_line_kept",
      waiterId: "identity_waiter_1",
      method: "cash",
      amountCop: 10_000,
      tipCop: 1_000,
      chargedAt: INSIDE,
    },
  ],
  cashCounts: [
    {
      shiftId: "shift_open",
      method: "cash",
      expectedCop: 10_000,
      countedCop: 9_000,
      closedAt: INSIDE,
    },
  ],
  staffHours: [
    {
      waiterId: "identity_waiter_1",
      workedMinutes: 120,
      latenessMinutes: 0,
      absent: false,
      corrected: false,
      at: INSIDE,
    },
  ],
  invoices: [
    {
      invoiceId: "invoice_1",
      buyer: "generic",
      capture: "unspecified",
      reinvoiceCount: 0,
      issuedAt: INSIDE,
    },
  ],
};

const stored: OperationSnapshot = {
  lines: [...kept.lines, line("line_old", OUTSIDE)],
  tenders: [
    ...kept.tenders,
    { ...kept.tenders[0], chargedAt: OUTSIDE, amountCop: 1 },
  ],
  cashCounts: [
    ...kept.cashCounts,
    { ...kept.cashCounts[0], closedAt: OUTSIDE, expectedCop: 1 },
  ],
  staffHours: [
    ...kept.staffHours,
    { ...kept.staffHours[0], at: OUTSIDE, workedMinutes: 1 },
  ],
  invoices: [
    ...kept.invoices,
    { ...kept.invoices[0], invoiceId: "invoice_old", issuedAt: OUTSIDE },
  ],
};

it("given the same period, when facts are read twice, then both reads match and the store is unchanged", async () => {
  const facts = new InMemoryOperationFacts([
    { tenantId: TENANT_ID, venueId: VENUE_ID, snapshot: stored },
  ]);

  const first = await facts.read(query);
  const second = await facts.read(query);

  expect(second).toEqual(first);
  expect(first).toEqual(kept);

  const sample = first.lines[0];

  if (sample) {
    sample.grossCop = 1;
  }

  const third = await facts.read(query);

  expect(third).toEqual(kept);
  expect(
    Object.getOwnPropertyNames(InMemoryOperationFacts.prototype).sort(),
  ).toEqual(["constructor", "read"]);
});

it("given another venue, when facts are read, then every section is empty", async () => {
  const facts = new InMemoryOperationFacts([
    { tenantId: TENANT_ID, venueId: VENUE_ID, snapshot: stored },
  ]);

  const snapshot = await facts.read({ ...query, venueId: OTHER_VENUE_ID });

  expect(snapshot).toEqual({
    lines: [],
    tenders: [],
    cashCounts: [],
    staffHours: [],
    invoices: [],
  });
});
