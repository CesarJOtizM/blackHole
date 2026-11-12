import type {
  ReportCommand,
  ReportDenial,
} from "#application/authorize-report/authorize-report.js";
import { loadReport } from "#application/load-report.js";
import type {
  OperationFacts,
  ServiceLineFact,
  StaffHoursFact,
  TenderFact,
  TenderMethod,
} from "#application/ports/operation-facts.js";
import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";
import { netSalesCop } from "#domain/metrics.js";

export interface StaffHoursRow {
  waiterId: string;
  workedMinutes: number;
  latenessMinutes: number;
  absent: boolean;
  corrected: boolean;
}

export interface StaffTipRow {
  waiterId: string;
  method: TenderMethod;
  tipCop: number;
}

export interface ProductivityRow {
  waiterId: string;
  stationId: string | null;
  netCopPerHour: number | null;
}

export interface StaffReport {
  salesPerHourCop: number | null;
  hours: readonly StaffHoursRow[];
  tips: readonly StaffTipRow[];
  productivity: readonly ProductivityRow[];
}

export type StaffReportResult =
  | { outcome: "denied"; reason: ReportDenial }
  | { outcome: "ready"; report: StaffReport };

const lineNet = (line: ServiceLineFact): number =>
  netSalesCop({
    grossCop: line.grossCop,
    discountCop: line.discountCop,
    includedTaxCop: line.includedTaxCop,
    tipCop: line.tipCop,
  });

const chargedLines = (
  lines: readonly ServiceLineFact[],
  from: string,
  to: string,
): ServiceLineFact[] =>
  lines.filter(
    (line) =>
      !line.voided &&
      line.chargedAt !== null &&
      line.chargedAt >= from &&
      line.chargedAt < to,
  );

const hoursOf = (rows: readonly StaffHoursFact[]): StaffHoursRow[] =>
  rows
    .map((row) => ({
      waiterId: row.waiterId,
      workedMinutes: row.workedMinutes,
      latenessMinutes: row.latenessMinutes,
      absent: row.absent,
      corrected: row.corrected,
    }))
    .sort(
      (left, right) =>
        left.waiterId.localeCompare(right.waiterId) ||
        left.workedMinutes - right.workedMinutes,
    );

const tipsOf = (
  tenders: readonly TenderFact[],
  from: string,
  to: string,
): StaffTipRow[] => {
  const grouped = new Map<string, StaffTipRow>();

  for (const tender of tenders) {
    if (
      tender.waiterId === null ||
      tender.tipCop === 0 ||
      tender.chargedAt < from ||
      tender.chargedAt >= to
    ) {
      continue;
    }

    const key = `${tender.waiterId}:${tender.method}`;
    const current = grouped.get(key) ?? {
      waiterId: tender.waiterId,
      method: tender.method,
      tipCop: 0,
    };
    current.tipCop += tender.tipCop;
    grouped.set(key, current);
  }

  return [...grouped.values()].sort(
    (left, right) =>
      left.waiterId.localeCompare(right.waiterId) ||
      left.method.localeCompare(right.method),
  );
};

const productivityOf = (
  lines: readonly ServiceLineFact[],
  hours: readonly StaffHoursFact[],
): ProductivityRow[] => {
  const minutesOf = new Map<string, number>();
  const netOf = new Map<string, number>();
  const stationNet = new Map<string, Map<string, number>>();

  for (const row of hours) {
    minutesOf.set(
      row.waiterId,
      (minutesOf.get(row.waiterId) ?? 0) + row.workedMinutes,
    );
  }

  for (const line of lines) {
    if (line.waiterId === null) {
      continue;
    }

    const net = lineNet(line);
    netOf.set(line.waiterId, (netOf.get(line.waiterId) ?? 0) + net);

    if (line.stationId === null) {
      continue;
    }

    const stations = stationNet.get(line.waiterId) ?? new Map<string, number>();
    stations.set(line.stationId, (stations.get(line.stationId) ?? 0) + net);
    stationNet.set(line.waiterId, stations);
  }

  const perHour = (waiterId: string, net: number): number | null => {
    const minutes = minutesOf.get(waiterId) ?? 0;

    if (minutes === 0) {
      return null;
    }

    return net / (minutes / 60);
  };

  const rows: ProductivityRow[] = [];
  const waiterIds = [...new Set([...minutesOf.keys(), ...netOf.keys()])].sort(
    (left, right) => left.localeCompare(right),
  );

  for (const waiterId of waiterIds) {
    rows.push({
      waiterId,
      stationId: null,
      netCopPerHour: perHour(waiterId, netOf.get(waiterId) ?? 0),
    });

    const stations = [...(stationNet.get(waiterId)?.keys() ?? [])].sort(
      (left, right) => left.localeCompare(right),
    );

    for (const stationId of stations) {
      rows.push({
        waiterId,
        stationId,
        netCopPerHour: perHour(
          waiterId,
          stationNet.get(waiterId)?.get(stationId) ?? 0,
        ),
      });
    }
  }

  return rows;
};

const staffOf = (
  lines: readonly ServiceLineFact[],
  tenders: readonly TenderFact[],
  hours: readonly StaffHoursFact[],
  from: string,
  to: string,
): StaffReport => {
  const sold = chargedLines(lines, from, to);
  const minutes = hours.reduce((total, row) => total + row.workedMinutes, 0);
  const net = sold.reduce((total, line) => total + lineNet(line), 0);

  return {
    salesPerHourCop: minutes === 0 ? null : net / (minutes / 60),
    hours: hoursOf(hours),
    tips: tipsOf(tenders, from, to),
    productivity: productivityOf(sold, hours),
  };
};

export class ReadStaffReport {
  constructor(
    private readonly access: ReportAccess,
    private readonly shifts: OpenShiftBounds,
    private readonly facts: OperationFacts,
  ) {}

  async execute(command: ReportCommand): Promise<StaffReportResult> {
    const loaded = await loadReport(
      this.access,
      this.shifts,
      this.facts,
      command,
    );

    if (loaded.outcome === "denied") {
      return loaded;
    }

    return {
      outcome: "ready",
      report: staffOf(
        loaded.snapshot.lines,
        loaded.snapshot.tenders,
        loaded.snapshot.staffHours,
        loaded.scope.from,
        loaded.scope.to,
      ),
    };
  }
}
