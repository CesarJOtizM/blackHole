import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { Check } from "#domain/check.js";

const VOID_SINK_ID = "check_void_sink";

export type ServiceChannel = "waiter" | "fixed_point" | "qr_table";

export interface ServiceLineFact {
  checkId: string;
  lineId: string;
  channel: ServiceChannel;
  diners: number | null;
  grossCop: number;
  discountCop: number;
  includedTaxCop?: number;
  tipCop?: number;
  voided: boolean;
  waiterId: string | null;
  stationId: string | null;
  openedAt: string | null;
  chargedAt: string | null;
  releasedAt: string | null;
  requestedAt: string | null;
  sentAt: string | null;
  inPreparationAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
}

export interface ListServiceFactsCommand {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
}

const inPeriod = (
  stamp: string | undefined,
  from: string,
  to: string,
): boolean => stamp !== undefined && stamp >= from && stamp < to;

const touchesPeriod = (
  check: Check,
  line: Check["orders"][number]["lines"][number],
  from: string,
  to: string,
): boolean =>
  [
    check.openedAt,
    check.chargedAt,
    check.releasedAt,
    check.preBillRequest?.requestedAt,
    line.sentAt,
    line.inPreparationAt,
    line.readyAt,
    line.deliveredAt,
  ].some((stamp) => inPeriod(stamp, from, to));

const factsFor = (check: Check, from: string, to: string): ServiceLineFact[] =>
  check.orders.flatMap((order) =>
    order.lines.flatMap((line) => {
      if (!touchesPeriod(check, line, from, to)) {
        return [];
      }

      return [
        {
          checkId: check.id,
          lineId: line.id,
          channel: order.channel,
          diners: check.diners,
          grossCop: line.price,
          discountCop: 0,
          voided: check.id === VOID_SINK_ID,
          waiterId: check.waiterId,
          stationId: line.stationId ?? null,
          openedAt: check.openedAt,
          chargedAt: check.chargedAt ?? null,
          releasedAt: check.releasedAt ?? null,
          requestedAt: check.preBillRequest?.requestedAt ?? null,
          sentAt: line.sentAt ?? null,
          inPreparationAt: line.inPreparationAt ?? null,
          readyAt: line.readyAt ?? null,
          deliveredAt: line.deliveredAt ?? null,
        },
      ];
    }),
  );

export class ListServiceFacts {
  constructor(private readonly diningRoom: DiningRoomRepository) {}

  async execute(
    command: ListServiceFactsCommand,
  ): Promise<readonly ServiceLineFact[]> {
    const checks = await this.diningRoom.listChecks(
      command.tenantId,
      command.venueId,
    );

    return checks
      .flatMap((check) => factsFor(check, command.from, command.to))
      .toSorted(
        (left, right) =>
          left.checkId.localeCompare(right.checkId) ||
          left.lineId.localeCompare(right.lineId),
      );
  }
}
