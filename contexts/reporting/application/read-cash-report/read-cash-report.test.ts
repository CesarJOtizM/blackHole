import { expect, it } from "vitest";

import { InMemoryOperationFacts } from "#adapters/memory/in-memory-operation-facts.js";
import type { ReportCommand } from "#application/authorize-report/authorize-report.js";
import type {
  CashCountFact,
  StoredOperation,
} from "#application/ports/operation-facts.js";
import {
  type OpenShiftBounds,
  REPORT_PERMISSION,
  type ReportAccess,
} from "#application/ports/report-access.js";
import { ReadCashReport } from "#application/read-cash-report/read-cash-report.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const FROM = "2026-11-11T05:00:00.000Z";
const TO = "2026-11-12T05:00:00.000Z";
const INSIDE = "2026-11-11T18:00:00.000Z";
const OUTSIDE = "2026-11-10T12:00:00.000Z";

const access = (counts: boolean): ReportAccess => ({
  allows: async (input) =>
    input.permission === REPORT_PERMISSION.VIEW_SALES ||
    (counts && input.permission === REPORT_PERMISSION.VIEW_EXPECTED_TOTAL),
});

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

const count = (
  method: CashCountFact["method"],
  expectedCop: number,
  countedCop: number,
  closedAt: string,
): CashCountFact => ({
  shiftId: "shift_open",
  method,
  expectedCop,
  countedCop,
  closedAt,
});

const stored: StoredOperation = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  snapshot: {
    lines: [],
    tenders: [],
    cashCounts: [
      count("cash", 80_000, 75_000, INSIDE),
      count("card", 20_000, 20_000, INSIDE),
      count("cash", 1, 1, OUTSIDE),
    ],
    staffHours: [],
    invoices: [],
  },
};

const reader = (counts: boolean, rows: readonly StoredOperation[]) =>
  new ReadCashReport(access(counts), shifts, new InMemoryOperationFacts(rows));

it("given a closed shift, when the reader may see the expected total, then expected, counted and difference are reported", async () => {
  const result = await reader(true, [stored]).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: {
      counts: {
        visible: true,
        rows: [
          {
            shiftId: "shift_open",
            method: "card",
            expectedCop: 20_000,
            countedCop: 20_000,
            differenceCop: 0,
          },
          {
            shiftId: "shift_open",
            method: "cash",
            expectedCop: 80_000,
            countedCop: 75_000,
            differenceCop: -5_000,
          },
        ],
      },
    },
  });
});

it("given a reader without cash.view-expected-total, when the cash report is read, then counts are hidden", async () => {
  const result = await reader(false, [stored]).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: { counts: { visible: false } },
  });
});

it("given permission and no closings, when the cash report is read, then no zero row is invented", async () => {
  const result = await reader(true, []).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: { counts: { visible: true, rows: [] } },
  });
});
