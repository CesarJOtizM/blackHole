import { existsSync } from "node:fs";
import { salesReportResult, siteReportResponse } from "@blackhole/contracts";
import { expect, it, vi } from "vitest";

import { ReportingFacts } from "#src/composition/reporting-facts.js";
import {
  ReadSiteReportController,
  routePermissions,
} from "#src/http/read-site-report.controller.js";
import {
  openDiningCloud,
  sessionHeader,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const today = {
  from: "2026-11-11T05:00:00.000Z",
  to: "2026-11-12T05:00:00.000Z",
};

const history = {
  from: "2026-10-01T05:00:00.000Z",
  to: "2026-10-02T05:00:00.000Z",
};

const reportUrl = (
  family: string,
  period: { from: string; to: string },
): string =>
  `/tenants/${tenantId}/venues/${venueId}/reports/${family}?from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}`;

const localNodeRoute = new URL(
  "../../../local-node/src/http/read-site-report.controller.ts",
  import.meta.url,
);

const getReport = (
  application: Awaited<ReturnType<typeof openDiningCloud>>["application"],
  family: string,
  period: { from: string; to: string },
  sessionId: string | null,
) =>
  application.inject({
    method: "GET",
    url: reportUrl(family, period),
    ...(sessionId === null ? {} : { headers: { [sessionHeader]: sessionId } }),
  });

it("given an owner session, when GET reports uses the shared day and history query, then each family parses and empty figures stay null", async () => {
  const { application } = await openDiningCloud();

  try {
    expect(routePermissions).toEqual({
      "GET reports/:family": "report.view-sales",
    });
    expect(existsSync(localNodeRoute)).toBe(false);
    expect(application.get(ReadSiteReportController)).toBeInstanceOf(
      ReadSiteReportController,
    );

    const todaySales = await getReport(
      application,
      "sales",
      today,
      "session_owner",
    );
    const historySales = await getReport(
      application,
      "sales",
      history,
      "session_owner",
    );
    const cash = await getReport(application, "cash", today, "session_owner");

    expect(todaySales.statusCode).toBe(200);
    expect(historySales.statusCode).toBe(200);
    expect(cash.statusCode).toBe(200);
    expect(salesReportResult.safeParse(todaySales.json()).success).toBe(true);
    expect(salesReportResult.safeParse(historySales.json()).success).toBe(true);
    expect(todaySales.json()).toMatchObject({
      outcome: "ready",
      report: {
        grossCop: null,
        netCop: null,
        ticketCount: null,
      },
    });
    expect(JSON.stringify(todaySales.json())).not.toContain('"grossCop":0');
    expect(JSON.stringify(historySales.json())).not.toContain('"grossCop":0');
    expect(
      siteReportResponse.safeParse({
        family: "cash",
        result: cash.json(),
      }).success,
    ).toBe(true);
    expect(cash.json()).toMatchObject({
      outcome: "ready",
      report: { counts: { visible: true, rows: [] } },
    });
    expect(JSON.stringify(cash.json())).not.toContain('"expectedCop":0');
  } finally {
    await application.close();
  }
});

it("given a kitchen chief without report.view-sales, when GET sales is injected, then the response is 403 and not a zeroed report", async () => {
  const { application } = await openDiningCloud();

  try {
    const response = await getReport(
      application,
      "sales",
      today,
      "session_kitchen",
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.stringify(response.json())).not.toContain('"grossCop":0');
  } finally {
    await application.close();
  }
});

it("given the fact read fails, when GET sales is injected, then the response is not a zeroed report", async () => {
  const { application } = await openDiningCloud();
  vi.spyOn(application.get(ReportingFacts), "read").mockRejectedValue(
    new Error("down"),
  );

  try {
    const response = await getReport(
      application,
      "sales",
      today,
      "session_owner",
    );

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: "ReportReadFailed" });
    expect(JSON.stringify(response.json())).not.toContain('"grossCop":0');
  } finally {
    await application.close();
  }
});
