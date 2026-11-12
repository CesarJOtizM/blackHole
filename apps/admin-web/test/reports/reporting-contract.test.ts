import { reportPeriodQuery, siteReportResponse } from "@blackhole/contracts";
import { describe, expect, it } from "vitest";

const period = {
  from: "2026-11-11T05:00:00.000Z",
  to: "2026-11-12T05:00:00.000Z",
};

const emptySales = {
  family: "sales",
  result: {
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
  },
};

describe("site report contract", () => {
  it("Given a period and the four families, When the query and body are parsed strictly, Then known keys pass and an extra key fails", () => {
    expect(reportPeriodQuery.safeParse(period).success).toBe(true);
    expect(reportPeriodQuery.safeParse({ from: period.from }).success).toBe(
      false,
    );
    expect(
      reportPeriodQuery.safeParse({ ...period, venueId: "chapinero" }).success,
    ).toBe(false);

    for (const family of ["sales", "times", "cash", "staff"]) {
      expect(
        siteReportResponse.safeParse({
          ...emptySales,
          family,
          result:
            family === "sales"
              ? emptySales.result
              : { outcome: "denied", reason: "missing_permission" },
        }).success,
      ).toBe(true);
    }

    expect(
      siteReportResponse.safeParse({ ...emptySales, note: "extra" }).success,
    ).toBe(false);
    expect(
      siteReportResponse.safeParse({ ...emptySales, family: "control" })
        .success,
    ).toBe(false);
  });
});
