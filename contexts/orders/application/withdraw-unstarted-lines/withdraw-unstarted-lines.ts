import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { RealtimeHub } from "#application/ports/realtime-hub.js";
import type { Check } from "#domain/check.js";

const BOGOTA_TIME_ZONE = "America/Bogota";

export interface WithdrawUnstartedLinesInput {
  tenantId: string;
  venueId: string;
  productId: string;
  uncoveredPortions: number;
  at: Date;
}

export interface WithdrawnCheck {
  checkId: string;
  tableId: string;
  lineIds: readonly string[];
}

export interface WithdrawUnstartedLinesResult {
  today: string;
  withdrawn: readonly WithdrawnCheck[];
}

interface SentLine {
  check: Check;
  lineId: string;
  sentAt: string;
  index: number;
}

const bogotaCalendarDate = (instant: Date): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
};

const withdrawCount = (uncoveredPortions: number): number => {
  if (!Number.isFinite(uncoveredPortions) || uncoveredPortions < 1) {
    return 0;
  }

  return Math.floor(uncoveredPortions);
};

const sentLinesOf = (
  checks: readonly Check[],
  input: WithdrawUnstartedLinesInput,
): SentLine[] => {
  const lines: SentLine[] = [];
  let index = 0;

  for (const check of checks) {
    if (check.tenantId !== input.tenantId || check.venueId !== input.venueId) {
      continue;
    }

    for (const order of check.orders) {
      for (const line of order.lines) {
        if (
          line.productId !== input.productId ||
          line.state !== "sent" ||
          line.sentAt === undefined
        ) {
          continue;
        }

        lines.push({
          check,
          lineId: line.id,
          sentAt: line.sentAt,
          index,
        });
        index += 1;
      }
    }
  }

  lines.sort((left, right) => {
    const byTime = left.sentAt.localeCompare(right.sentAt);

    return byTime === 0 ? left.index - right.index : byTime;
  });

  return lines;
};

export class WithdrawUnstartedLines {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly hub: RealtimeHub,
  ) {}

  async execute(
    input: WithdrawUnstartedLinesInput,
  ): Promise<WithdrawUnstartedLinesResult> {
    const today = bogotaCalendarDate(input.at);
    const count = withdrawCount(input.uncoveredPortions);

    if (count === 0) {
      return { today, withdrawn: [] };
    }

    const checks = await this.diningRoom.listChecks(
      input.tenantId,
      input.venueId,
    );
    const selected = sentLinesOf(checks, input).slice(0, count);
    const grouped = new Map<Check, string[]>();

    for (const line of selected) {
      const lineIds = grouped.get(line.check);

      if (lineIds === undefined) {
        grouped.set(line.check, [line.lineId]);
        continue;
      }

      lineIds.push(line.lineId);
    }

    const at = input.at.toISOString();
    const withdrawn: WithdrawnCheck[] = [];

    for (const [check, lineIds] of grouped) {
      check.withdrawUncoveredSent({
        productId: input.productId,
        uncoveredPortions: lineIds.length,
        at,
      });
      await this.diningRoom.saveCheck(check);

      const copiedLineIds = [...lineIds];

      await this.hub.publish({
        kind: "not_restocked",
        tenantId: check.tenantId,
        venueId: check.venueId,
        checkId: check.id,
        tableId: check.tableId,
        productId: input.productId,
        lineIds: copiedLineIds,
        at,
      });
      withdrawn.push({
        checkId: check.id,
        tableId: check.tableId,
        lineIds: [...copiedLineIds],
      });
    }

    return { today, withdrawn };
  }
}
