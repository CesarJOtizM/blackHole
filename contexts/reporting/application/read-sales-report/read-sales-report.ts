import type {
  ReportCommand,
  ReportDenial,
} from "#application/authorize-report/authorize-report.js";
import { loadReport } from "#application/load-report.js";
import type {
  OperationFacts,
  SalesChannel,
  ServiceLineFact,
  TenderFact,
  TenderMethod,
} from "#application/ports/operation-facts.js";
import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";
import { bogotaHour, netSalesCop } from "#domain/metrics.js";

export interface ProductRank {
  productId: string;
  productName: string;
  quantity: number;
  netCop: number;
}

export interface SalesReport {
  grossCop: number | null;
  netCop: number | null;
  ticketCount: number | null;
  averageTicketCop: number | null;
  ticketPerDinerCop: number | null;
  hourBands: readonly { hour: number; netCop: number }[];
  channels: readonly {
    channel: SalesChannel;
    grossCop: number;
    netCop: number;
  }[];
  waiters: readonly { waiterId: string; netCop: number; tipCop: number }[];
  products: { top: ProductRank | null; bottom: ProductRank | null };
  rotation: number | null;
  tenders: readonly {
    method: TenderMethod;
    amountCop: number;
    share: number | null;
  }[];
}

export type SalesReportResult =
  | { outcome: "denied"; reason: ReportDenial }
  | { outcome: "ready"; report: SalesReport };

const EMPTY_SALES: SalesReport = {
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
};

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

const sum = (
  lines: readonly ServiceLineFact[],
  pick: (line: ServiceLineFact) => number,
): number => lines.reduce((total, line) => total + pick(line), 0);

const hourBandsOf = (
  lines: readonly ServiceLineFact[],
): SalesReport["hourBands"] => {
  const bands = new Map<number, number>();

  for (const line of lines) {
    if (line.chargedAt === null) {
      continue;
    }

    const hour = bogotaHour(line.chargedAt);
    bands.set(hour, (bands.get(hour) ?? 0) + lineNet(line));
  }

  return [...bands.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([hour, netCop]) => ({ hour, netCop }));
};

const channelsOf = (
  lines: readonly ServiceLineFact[],
): SalesReport["channels"] => {
  const grouped = new Map<SalesChannel, { grossCop: number; netCop: number }>();

  for (const line of lines) {
    const current = grouped.get(line.channel) ?? { grossCop: 0, netCop: 0 };
    current.grossCop += line.grossCop;
    current.netCop += lineNet(line);
    grouped.set(line.channel, current);
  }

  return [...grouped.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([channel, totals]) => ({ channel, ...totals }));
};

const productsOf = (
  lines: readonly ServiceLineFact[],
): SalesReport["products"] => {
  const grouped = new Map<string, ProductRank>();

  for (const line of lines) {
    const current = grouped.get(line.productId) ?? {
      productId: line.productId,
      productName: line.productName,
      quantity: 0,
      netCop: 0,
    };
    current.quantity += line.quantity;
    current.netCop += lineNet(line);
    grouped.set(line.productId, current);
  }

  const ranked = [...grouped.values()].sort(
    (left, right) =>
      right.netCop - left.netCop ||
      left.productId.localeCompare(right.productId),
  );

  return {
    top: ranked[0] ?? null,
    bottom: ranked.at(-1) ?? null,
  };
};

const tendersOf = (
  tenders: readonly TenderFact[],
  checkIds: ReadonlySet<string>,
  from: string,
  to: string,
): { rows: SalesReport["tenders"]; tips: Map<string, number> } => {
  const matched = tenders.filter(
    (tender) =>
      checkIds.has(tender.checkId) &&
      tender.chargedAt >= from &&
      tender.chargedAt < to,
  );
  const total = matched.reduce(
    (summed, tender) => summed + tender.amountCop,
    0,
  );
  const byMethod = new Map<TenderMethod, number>();
  const tips = new Map<string, number>();

  for (const tender of matched) {
    byMethod.set(
      tender.method,
      (byMethod.get(tender.method) ?? 0) + tender.amountCop,
    );

    if (tender.waiterId !== null) {
      tips.set(
        tender.waiterId,
        (tips.get(tender.waiterId) ?? 0) + tender.tipCop,
      );
    }
  }

  return {
    rows: [...byMethod.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([method, amountCop]) => ({
        method,
        amountCop,
        share: total === 0 ? null : amountCop / total,
      })),
    tips,
  };
};

const waitersOf = (
  lines: readonly ServiceLineFact[],
  tips: ReadonlyMap<string, number>,
): SalesReport["waiters"] => {
  const nets = new Map<string, number>();

  for (const line of lines) {
    if (line.waiterId === null) {
      continue;
    }

    nets.set(line.waiterId, (nets.get(line.waiterId) ?? 0) + lineNet(line));
  }

  const waiterIds = new Set([...nets.keys(), ...tips.keys()]);

  return [...waiterIds]
    .sort((left, right) => left.localeCompare(right))
    .map((waiterId) => ({
      waiterId,
      netCop: nets.get(waiterId) ?? 0,
      tipCop: tips.get(waiterId) ?? 0,
    }));
};

const salesOf = (
  snapshot: {
    lines: readonly ServiceLineFact[];
    tenders: readonly TenderFact[];
  },
  from: string,
  to: string,
): SalesReport => {
  const lines = chargedLines(snapshot.lines, from, to);

  if (lines.length === 0) {
    return EMPTY_SALES;
  }

  const grossCop = sum(lines, (line) => line.grossCop);
  const netCop = netSalesCop({
    grossCop,
    discountCop: sum(lines, (line) => line.discountCop),
    includedTaxCop: sum(lines, (line) => line.includedTaxCop),
    tipCop: sum(lines, (line) => line.tipCop),
  });
  const checkIds = new Set(lines.map((line) => line.checkId));
  const dinersByCheck = new Map<string, number>();

  for (const line of lines) {
    if (dinersByCheck.has(line.checkId) || line.diners === null) {
      continue;
    }

    dinersByCheck.set(line.checkId, line.diners);
  }

  const diners = [...dinersByCheck.values()].reduce(
    (total, value) => total + value,
    0,
  );
  const ticketCount = checkIds.size;
  const tenders = tendersOf(snapshot.tenders, checkIds, from, to);

  return {
    grossCop,
    netCop,
    ticketCount,
    averageTicketCop: netCop / ticketCount,
    ticketPerDinerCop: diners === 0 ? null : netCop / diners,
    hourBands: hourBandsOf(lines),
    channels: channelsOf(lines),
    waiters: waitersOf(lines, tenders.tips),
    products: productsOf(lines),
    rotation: ticketCount,
    tenders: tenders.rows,
  };
};

export class ReadSalesReport {
  constructor(
    private readonly access: ReportAccess,
    private readonly shifts: OpenShiftBounds,
    private readonly facts: OperationFacts,
  ) {}

  async execute(command: ReportCommand): Promise<SalesReportResult> {
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
      report: salesOf(loaded.snapshot, loaded.scope.from, loaded.scope.to),
    };
  }
}
