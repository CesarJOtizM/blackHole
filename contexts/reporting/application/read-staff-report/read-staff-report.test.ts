import { expect, it } from "vitest";

import { InMemoryOperationFacts } from "#adapters/memory/in-memory-operation-facts.js";
import type { ReportCommand } from "#application/authorize-report/authorize-report.js";
import type {
  ServiceLineFact,
  StoredOperation,
} from "#application/ports/operation-facts.js";
import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";
import { ReadStaffReport } from "#application/read-staff-report/read-staff-report.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const WAITER_ID = "identity_waiter_1";
const FROM = "2026-11-11T05:00:00.000Z";
const TO = "2026-11-12T05:00:00.000Z";
const INSIDE = "2026-11-11T18:00:00.000Z";
const OUTSIDE = "2026-11-10T12:00:00.000Z";

const access: ReportAccess = { allows: async () => true };
const shifts: OpenShiftBounds = { findOpen: async () => null };

const command = (): ReportCommand => ({
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
});

const line = (): ServiceLineFact => ({
  checkId: "check_1",
  lineId: "line_1",
  tableId: "table_1",
  productId: "product_arepa",
  productName: "Arepa",
  stationId: "station_grill",
  waiterId: WAITER_ID,
  channel: "waiter",
  quantity: 1,
  grossCop: 2_000_000,
  discountCop: 0,
  includedTaxCop: 0,
  tipCop: 0,
  voided: false,
  diners: 2,
  openedAt: INSIDE,
  sentAt: INSIDE,
  inPreparationAt: INSIDE,
  readyAt: INSIDE,
  deliveredAt: INSIDE,
  requestedAt: INSIDE,
  chargedAt: INSIDE,
  releasedAt: INSIDE,
});

const stored: StoredOperation = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  snapshot: {
    lines: [line()],
    tenders: [
      {
        checkId: "check_1",
        waiterId: WAITER_ID,
        method: "cash",
        amountCop: 2_000_000,
        tipCop: 4_000,
        chargedAt: INSIDE,
      },
    ],
    cashCounts: [],
    staffHours: [
      {
        waiterId: WAITER_ID,
        workedMinutes: 40 * 60,
        latenessMinutes: 15,
        absent: false,
        corrected: true,
        at: INSIDE,
      },
      {
        waiterId: WAITER_ID,
        workedMinutes: 9_999,
        latenessMinutes: 0,
        absent: true,
        corrected: false,
        at: OUTSIDE,
      },
    ],
    invoices: [],
  },
};

const reader = (rows: readonly StoredOperation[]) =>
  new ReadStaffReport(access, shifts, new InMemoryOperationFacts(rows));

it("given net sales of 2000000 and 40 staff hours, when the staff report runs, then sales per hour worked is 50000", async () => {
  const result = await reader([stored]).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: {
      salesPerHourCop: 50_000,
      hours: [
        {
          waiterId: WAITER_ID,
          workedMinutes: 2_400,
          latenessMinutes: 15,
          absent: false,
          corrected: true,
        },
      ],
      tips: [{ waiterId: WAITER_ID, method: "cash", tipCop: 4_000 }],
      productivity: [
        {
          waiterId: WAITER_ID,
          stationId: null,
          netCopPerHour: 50_000,
        },
        {
          waiterId: WAITER_ID,
          stationId: "station_grill",
          netCopPerHour: 50_000,
        },
      ],
    },
  });
  expect(result).not.toHaveProperty("report.salary");
  expect(JSON.stringify(result)).not.toContain("salary");
});

it("given no staff hours and no sales, when the staff report runs, then sales per hour is absent rather than zero", async () => {
  const result = await reader([]).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: {
      salesPerHourCop: null,
      hours: [],
      tips: [],
      productivity: [],
    },
  });
});
