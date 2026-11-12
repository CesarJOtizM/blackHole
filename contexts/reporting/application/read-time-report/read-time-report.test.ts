import { expect, it } from "vitest";

import { InMemoryOperationFacts } from "#adapters/memory/in-memory-operation-facts.js";
import type {
  ServiceLineFact,
  StoredOperation,
} from "#application/ports/operation-facts.js";
import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";
import {
  ReadTimeReport,
  type TimeReport,
  type TimeReportCommand,
} from "#application/read-time-report/read-time-report.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const FROM = "2026-11-11T05:00:00.000Z";
const TO = "2026-11-12T05:00:00.000Z";
const OPENED = "2026-11-11T18:00:00.000Z";
const LATER = "2026-11-11T22:00:00.000Z";

const absent = { averageMs: null, p50Ms: null, p90Ms: null };
const only = (ms: number) => ({ averageMs: ms, p50Ms: ms, p90Ms: ms });

const access: ReportAccess = { allows: async () => true };
const shifts: OpenShiftBounds = { findOpen: async () => null };

const at = (seconds: number, base = OPENED): string =>
  new Date(Date.parse(base) + seconds * 1000).toISOString();

const command = (
  overrides: Partial<TimeReportCommand> = {},
): TimeReportCommand => ({
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
  stationId: null,
  productId: null,
  hour: null,
  weekday: null,
  ...overrides,
});

const line = (overrides: Partial<ServiceLineFact> = {}): ServiceLineFact => ({
  checkId: "check_1",
  lineId: "line_1",
  tableId: "table_1",
  productId: "product_arepa",
  productName: "Arepa",
  stationId: "station_grill",
  waiterId: "identity_waiter_1",
  channel: "waiter",
  quantity: 1,
  grossCop: 0,
  discountCop: 0,
  includedTaxCop: 0,
  tipCop: 0,
  voided: false,
  diners: 2,
  openedAt: at(0),
  sentAt: at(60),
  inPreparationAt: at(180),
  readyAt: at(300),
  deliveredAt: at(420),
  requestedAt: at(480),
  chargedAt: at(600),
  releasedAt: at(900),
  ...overrides,
});

const pack = (
  lines: readonly ServiceLineFact[],
  venueId = VENUE_ID,
): StoredOperation => ({
  tenantId: TENANT_ID,
  venueId,
  snapshot: {
    lines: [...lines],
    tenders: [],
    cashCounts: [],
    staffHours: [],
    invoices: [],
  },
});

const reader = (rows: readonly StoredOperation[]) =>
  new ReadTimeReport(access, shifts, new InMemoryOperationFacts(rows));

const read = async (
  lines: readonly ServiceLineFact[],
  overrides: Partial<TimeReportCommand> = {},
): Promise<TimeReport> => {
  const result = await reader([pack(lines)]).execute(command(overrides));

  if (result.outcome !== "ready") {
    throw new Error(result.reason);
  }

  return result.report;
};

it("given a service with both ends, when times are read, then each span is the difference", async () => {
  const report = await read([line()]);

  expect(report).toEqual({
    orderTaking: only(60_000),
    kitchenWait: only(120_000),
    preparation: only(120_000),
    totalKitchen: only(240_000),
    tableDelivery: only(120_000),
    totalService: only(360_000),
    tableDuration: only(900_000),
    payment: only(120_000),
  });
});

it("given a missing end for each span, when times are read, then that span contributes no value", async () => {
  expect((await read([line({ sentAt: null })])).orderTaking).toEqual(absent);
  expect((await read([line({ inPreparationAt: null })])).kitchenWait).toEqual(
    absent,
  );
  expect((await read([line({ readyAt: null })])).preparation).toEqual(absent);
  expect((await read([line({ readyAt: null })])).totalKitchen).toEqual(absent);
  expect((await read([line({ deliveredAt: null })])).tableDelivery).toEqual(
    absent,
  );
  expect((await read([line({ deliveredAt: null })])).totalService).toEqual(
    absent,
  );
  expect((await read([line({ releasedAt: null })])).tableDuration).toEqual(
    absent,
  );
  expect((await read([line({ chargedAt: null })])).tableDuration).toEqual(
    absent,
  );
  expect((await read([line({ chargedAt: null })])).payment).toEqual(absent);
  expect((await read([line({ requestedAt: null })])).payment).toEqual(absent);
});

it("given grill and bar lines, when preparation is filtered by grill, then only grill feeds average, p50 and p90", async () => {
  const prep = (
    lineId: string,
    stationId: string,
    seconds: number,
    voided = false,
  ): ServiceLineFact =>
    line({
      checkId: `check_${lineId}`,
      lineId,
      stationId,
      inPreparationAt: at(0),
      readyAt: at(seconds),
      voided,
    });
  const report = await read(
    [
      prep("slow", "station_grill", 400),
      prep("mid", "station_grill", 200),
      prep("fast", "station_grill", 100),
      prep("bar", "station_bar", 999),
      prep("void", "station_grill", 9_999, true),
    ],
    { stationId: "station_grill" },
  );

  expect(report.preparation).toEqual({
    averageMs: 700_000 / 3,
    p50Ms: 200_000,
    p90Ms: 400_000,
  });
});

it("given a filter with no matching lines, when times are requested, then no figures are shown", async () => {
  const report = await read([line()], { stationId: "station_missing" });

  expect(report).toEqual({
    orderTaking: absent,
    kitchenWait: absent,
    preparation: absent,
    totalKitchen: absent,
    tableDelivery: absent,
    totalService: absent,
    tableDuration: absent,
    payment: absent,
  });
});

it("given two hour bands, when the report is filtered by the Bogota hour, then the other band is excluded", async () => {
  const report = await read(
    [
      line(),
      line({
        checkId: "check_later",
        lineId: "line_later",
        openedAt: LATER,
        sentAt: at(10, LATER),
      }),
    ],
    { hour: 13 },
  );

  expect(report.orderTaking).toEqual(only(60_000));
});

it("given a Wednesday service, when the weekday filter excludes it, then no figures are shown", async () => {
  const report = await read([line()], { weekday: "thursday" });

  expect(report.orderTaking).toEqual(absent);
  expect(report.preparation).toEqual(absent);
});

it("given a Wednesday service, when the weekday filter matches, then that service is included", async () => {
  const report = await read([line()], { weekday: "wednesday" });

  expect(report.orderTaking).toEqual(only(60_000));
});

it("given two products, when the report is filtered by product, then the other product is excluded", async () => {
  const report = await read(
    [
      line({ readyAt: at(200) }),
      line({
        checkId: "check_juice",
        lineId: "line_juice",
        productId: "product_juice",
        inPreparationAt: at(0),
        readyAt: at(999),
      }),
    ],
    { productId: "product_arepa" },
  );

  expect(report.preparation).toEqual(only(20_000));
});

it("given two waiters, when the report is limited to one waiter, then the other waiter is excluded", async () => {
  const report = await read(
    [
      line(),
      line({
        checkId: "check_other",
        lineId: "line_other",
        waiterId: "identity_waiter_2",
        sentAt: at(10),
      }),
    ],
    { subjectWaiterId: "identity_waiter_1" },
  );

  expect(report.orderTaking).toEqual(only(60_000));
});

it("given two venues, when times are read for one site, then the other site is excluded", async () => {
  const result = await reader([
    pack([line({ readyAt: at(200) })]),
    pack(
      [
        line({
          checkId: "check_other",
          lineId: "line_other",
          readyAt: at(999),
        }),
      ],
      OTHER_VENUE_ID,
    ),
  ]).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: expect.objectContaining({
      preparation: only(20_000),
    }),
  });
});
