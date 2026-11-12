import {
  type ReportFamily,
  reportFamily,
  reportPeriodQuery,
  siteReportResponse,
} from "@blackhole/contracts";
import { ADMIN_SCOPE } from "#src/api/admin-api.js";

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const bogotaToday = (now: number): { from: string; to: string } => {
  const local = new Date(now - BOGOTA_OFFSET_MS);
  const date = local.toISOString().slice(0, 10);
  const start = Date.parse(`${date}T00:00:00.000Z`) + BOGOTA_OFFSET_MS;
  return {
    from: new Date(start).toISOString(),
    to: new Date(start + DAY_MS).toISOString(),
  };
};

export interface SalesFigures {
  grossCop: number | null;
  netCop: number | null;
  ticketCount: number | null;
}

export type ReportSnapshot =
  | { family: "sales"; report: SalesFigures }
  | { family: "times" | "cash" | "staff"; report: { empty: boolean } };

export type SiteReportReader = (query: {
  family: ReportFamily;
  from: string;
  to: string;
}) => Promise<ReportSnapshot>;

export const isSiteFamily = (value: string): value is ReportFamily =>
  reportFamily.safeParse(value).success;

function failRead(): never {
  throw new Error("Report read failed");
}

export async function readSiteReport(query: {
  family: ReportFamily;
  from: string;
  to: string;
}): Promise<ReportSnapshot> {
  if (
    !reportPeriodQuery.safeParse({ from: query.from, to: query.to }).success ||
    !reportFamily.safeParse(query.family).success
  ) {
    return failRead();
  }

  const response = await fetch(
    `/tenants/${ADMIN_SCOPE.tenantId}/venues/${ADMIN_SCOPE.venueId}/reports/${query.family}?from=${encodeURIComponent(query.from)}&to=${encodeURIComponent(query.to)}`,
    { headers: { "x-session-id": ADMIN_SCOPE.sessionId } },
  );
  if (!response.ok) {
    return failRead();
  }

  const body: unknown = await response.json();
  const parsed = siteReportResponse.safeParse({
    family: query.family,
    result: body,
  });
  if (parsed.success === false) {
    return failRead();
  }

  const ready = parsed.data;
  if (ready.family === "sales") {
    if (ready.result.outcome !== "ready") {
      return failRead();
    }

    return {
      family: "sales",
      report: {
        grossCop: ready.result.report.grossCop,
        netCop: ready.result.report.netCop,
        ticketCount: ready.result.report.ticketCount,
      },
    };
  }

  if (ready.family === "times") {
    if (ready.result.outcome !== "ready") {
      return failRead();
    }

    const figures = [
      ready.result.report.orderTaking,
      ready.result.report.kitchenWait,
      ready.result.report.preparation,
      ready.result.report.totalKitchen,
      ready.result.report.tableDelivery,
      ready.result.report.totalService,
      ready.result.report.tableDuration,
      ready.result.report.payment,
    ];
    return {
      family: "times",
      report: {
        empty: figures.every(
          (item) =>
            item.averageMs === null &&
            item.p50Ms === null &&
            item.p90Ms === null,
        ),
      },
    };
  }

  if (ready.family === "cash") {
    if (ready.result.outcome !== "ready") {
      return failRead();
    }

    const counts = ready.result.report.counts;
    return {
      family: "cash",
      report: {
        empty: counts.visible === false || counts.rows.length === 0,
      },
    };
  }

  if (ready.result.outcome !== "ready") {
    return failRead();
  }

  const report = ready.result.report;
  return {
    family: "staff",
    report: {
      empty:
        report.salesPerHourCop === null &&
        report.hours.length === 0 &&
        report.tips.length === 0 &&
        report.productivity.length === 0,
    },
  };
}
