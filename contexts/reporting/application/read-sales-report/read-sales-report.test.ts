import { expect, it } from "vitest";

import { InMemoryOperationFacts } from "#adapters/memory/in-memory-operation-facts.js";
import type { ReportCommand } from "#application/authorize-report/authorize-report.js";
import type {
  OperationSnapshot,
  ServiceLineFact,
  StoredOperation,
} from "#application/ports/operation-facts.js";
import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";
import { ReadSalesReport } from "#application/read-sales-report/read-sales-report.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const FROM = "2026-11-11T05:00:00.000Z";
const TO = "2026-11-12T05:00:00.000Z";
const AT_13 = "2026-11-11T18:30:00.000Z";
const AT_20 = "2026-11-12T01:30:00.000Z";

const access: ReportAccess = { allows: async () => true };
const shifts: OpenShiftBounds = { findOpen: async () => null };

const command = (overrides: Partial<ReportCommand> = {}): ReportCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: "identity_user_1",
  role: "site_administrator",
  homeVenueId: VENUE_ID,
  waiterId: null,
  subjectWaiterId: null,
  shiftId: null,
  from: FROM,
  to: TO,
  ...overrides,
});

const line = (overrides: Partial<ServiceLineFact>): ServiceLineFact => ({
  checkId: "check_1",
  lineId: "line_1",
  tableId: "table_1",
  productId: "product_arepa",
  productName: "Arepa",
  stationId: "station_grill",
  waiterId: "identity_waiter_1",
  channel: "waiter",
  quantity: 2,
  grossCop: 10_000,
  discountCop: 1_000,
  includedTaxCop: 500,
  tipCop: 200,
  voided: false,
  diners: 4,
  openedAt: AT_13,
  sentAt: AT_13,
  inPreparationAt: AT_13,
  readyAt: AT_13,
  deliveredAt: AT_13,
  requestedAt: AT_13,
  chargedAt: AT_13,
  releasedAt: AT_13,
  ...overrides,
});

const snapshot: OperationSnapshot = {
  lines: [
    line({}),
    line({
      lineId: "line_void",
      grossCop: 99_000,
      discountCop: 0,
      includedTaxCop: 0,
      tipCop: 0,
      voided: true,
    }),
    line({
      checkId: "check_2",
      lineId: "line_2",
      tableId: "table_2",
      productId: "product_juice",
      productName: "Juice",
      stationId: "station_bar",
      waiterId: "identity_waiter_2",
      channel: "fixed_point",
      quantity: 1,
      grossCop: 4_000,
      discountCop: 0,
      includedTaxCop: 0,
      tipCop: 0,
      diners: 2,
      openedAt: AT_20,
      sentAt: AT_20,
      inPreparationAt: AT_20,
      readyAt: AT_20,
      deliveredAt: AT_20,
      requestedAt: AT_20,
      chargedAt: AT_20,
      releasedAt: AT_20,
    }),
  ],
  tenders: [
    {
      checkId: "check_1",
      waiterId: "identity_waiter_1",
      method: "cash",
      amountCop: 8_300,
      tipCop: 200,
      chargedAt: AT_13,
    },
    {
      checkId: "check_2",
      waiterId: "identity_waiter_2",
      method: "card",
      amountCop: 4_000,
      tipCop: 0,
      chargedAt: AT_20,
    },
  ],
  cashCounts: [],
  staffHours: [],
  invoices: [],
};

const stored: StoredOperation = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  snapshot,
};

const reader = (rows: readonly StoredOperation[]) =>
  new ReadSalesReport(access, shifts, new InMemoryOperationFacts(rows));

it("given charged lines, when sales are read, then gross, net, tickets, channels, tips, products, rotation and tenders match", async () => {
  const result = await reader([stored]).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: {
      grossCop: 14_000,
      netCop: 12_300,
      ticketCount: 2,
      averageTicketCop: 6_150,
      ticketPerDinerCop: 2_050,
      hourBands: [
        { hour: 13, netCop: 8_300 },
        { hour: 20, netCop: 4_000 },
      ],
      channels: [
        { channel: "fixed_point", grossCop: 4_000, netCop: 4_000 },
        { channel: "waiter", grossCop: 10_000, netCop: 8_300 },
      ],
      waiters: [
        { waiterId: "identity_waiter_1", netCop: 8_300, tipCop: 200 },
        { waiterId: "identity_waiter_2", netCop: 4_000, tipCop: 0 },
      ],
      products: {
        top: {
          productId: "product_arepa",
          productName: "Arepa",
          quantity: 2,
          netCop: 8_300,
        },
        bottom: {
          productId: "product_juice",
          productName: "Juice",
          quantity: 1,
          netCop: 4_000,
        },
      },
      rotation: 2,
      tenders: [
        { method: "card", amountCop: 4_000, share: 4_000 / 12_300 },
        { method: "cash", amountCop: 8_300, share: 8_300 / 12_300 },
      ],
    },
  });
});

it("given no charged lines, when sales are read, then figures are absent rather than zero", async () => {
  const result = await reader([]).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: {
      grossCop: null,
      netCop: null,
      ticketCount: null,
      averageTicketCop: null,
      ticketPerDinerCop: null,
      hourBands: [],
      channels: [],
      waiters: [],
      products: { top: null, bottom: null },
      rotation: null,
      tenders: [],
    },
  });
});

it("given an administrator of another venue, when sales are read, then access is denied", async () => {
  const result = await reader([stored]).execute(
    command({ homeVenueId: OTHER_VENUE_ID }),
  );

  expect(result).toEqual({ outcome: "denied", reason: "other_venue" });
});
