import type {
  ReportCommand,
  ReportDenial,
} from "#application/authorize-report/authorize-report.js";
import { loadReport } from "#application/load-report.js";
import type {
  OperationFacts,
  ServiceLineFact,
} from "#application/ports/operation-facts.js";
import type {
  OpenShiftBounds,
  ReportAccess,
} from "#application/ports/report-access.js";
import {
  average,
  bogotaHour,
  bogotaWeekday,
  durationMs,
  nearestRank,
  type Weekday,
} from "#domain/metrics.js";

export interface DurationFigures {
  averageMs: number | null;
  p50Ms: number | null;
  p90Ms: number | null;
}

export interface TimeReport {
  orderTaking: DurationFigures;
  kitchenWait: DurationFigures;
  preparation: DurationFigures;
  totalKitchen: DurationFigures;
  tableDelivery: DurationFigures;
  totalService: DurationFigures;
  tableDuration: DurationFigures;
  payment: DurationFigures;
}

export interface TimeReportCommand extends ReportCommand {
  stationId: string | null;
  productId: string | null;
  hour: number | null;
  weekday: Weekday | null;
}

export type TimeReportResult =
  | { outcome: "denied"; reason: ReportDenial }
  | { outcome: "ready"; report: TimeReport };

const EMPTY_FIGURES: DurationFigures = {
  averageMs: null,
  p50Ms: null,
  p90Ms: null,
};

const figures = (samples: readonly number[]): DurationFigures => {
  if (samples.length === 0) {
    return EMPTY_FIGURES;
  }

  return {
    averageMs: average(samples),
    p50Ms: nearestRank(samples, 50),
    p90Ms: nearestRank(samples, 90),
  };
};

const anchorOf = (line: ServiceLineFact): string | null =>
  line.openedAt ?? line.sentAt;

const selected = (
  lines: readonly ServiceLineFact[],
  command: TimeReportCommand,
): ServiceLineFact[] =>
  lines.filter((line) => {
    if (line.voided) {
      return false;
    }

    if (command.stationId !== null && line.stationId !== command.stationId) {
      return false;
    }

    if (command.productId !== null && line.productId !== command.productId) {
      return false;
    }

    const anchor = anchorOf(line);

    if (
      command.hour !== null &&
      (anchor === null || bogotaHour(anchor) !== command.hour)
    ) {
      return false;
    }

    if (
      command.weekday !== null &&
      (anchor === null || bogotaWeekday(anchor) !== command.weekday)
    ) {
      return false;
    }

    return true;
  });

const firstInstant = (
  lines: readonly ServiceLineFact[],
  pick: (line: ServiceLineFact) => string | null,
): string | null => lines.map(pick).find((value) => value !== null) ?? null;

const pushDuration = (
  samples: number[],
  startedAt: string | null,
  endedAt: string | null,
): void => {
  const duration = durationMs(startedAt, endedAt);

  if (duration !== null) {
    samples.push(duration);
  }
};

const timesOf = (lines: readonly ServiceLineFact[]): TimeReport => {
  const kitchenWait: number[] = [];
  const preparation: number[] = [];
  const totalKitchen: number[] = [];
  const tableDelivery: number[] = [];
  const totalService: number[] = [];
  const orderTaking: number[] = [];
  const tableDuration: number[] = [];
  const payment: number[] = [];
  const byCheck = new Map<string, ServiceLineFact[]>();

  for (const line of lines) {
    pushDuration(kitchenWait, line.sentAt, line.inPreparationAt);
    pushDuration(preparation, line.inPreparationAt, line.readyAt);
    pushDuration(totalKitchen, line.sentAt, line.readyAt);
    pushDuration(tableDelivery, line.readyAt, line.deliveredAt);
    pushDuration(totalService, line.sentAt, line.deliveredAt);

    const group = byCheck.get(line.checkId) ?? [];
    group.push(line);
    byCheck.set(line.checkId, group);
  }

  for (const group of byCheck.values()) {
    const sentAt = [...group.map((line) => line.sentAt)]
      .filter((value): value is string => value !== null)
      .sort()[0];

    pushDuration(
      orderTaking,
      firstInstant(group, (line) => line.openedAt),
      sentAt ?? null,
    );

    const chargedAt = firstInstant(group, (line) => line.chargedAt);

    if (chargedAt !== null) {
      pushDuration(
        tableDuration,
        firstInstant(group, (line) => line.openedAt),
        firstInstant(group, (line) => line.releasedAt),
      );
    }

    pushDuration(
      payment,
      firstInstant(group, (line) => line.requestedAt),
      chargedAt,
    );
  }

  return {
    orderTaking: figures(orderTaking),
    kitchenWait: figures(kitchenWait),
    preparation: figures(preparation),
    totalKitchen: figures(totalKitchen),
    tableDelivery: figures(tableDelivery),
    totalService: figures(totalService),
    tableDuration: figures(tableDuration),
    payment: figures(payment),
  };
};

export class ReadTimeReport {
  constructor(
    private readonly access: ReportAccess,
    private readonly shifts: OpenShiftBounds,
    private readonly facts: OperationFacts,
  ) {}

  async execute(command: TimeReportCommand): Promise<TimeReportResult> {
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
      report: timesOf(selected(loaded.snapshot.lines, command)),
    };
  }
}
