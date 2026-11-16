import type { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { RealtimeHub } from "#application/ports/realtime-hub.js";
import { type Check, InvalidLineId, TableNotOpen } from "#domain/check.js";

export interface MarkLineUndeliverableInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  lineId: string;
}

const lineOf = (check: Check, lineId: string) =>
  check.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId);

export class MarkLineUndeliverable {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly clock: Clock,
    private readonly hub: RealtimeHub,
  ) {}

  async execute(input: MarkLineUndeliverableInput): Promise<Check> {
    const check = await this.diningRoom.loadCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (check === null) {
      throw new TableNotOpen();
    }

    const line = lineOf(check, input.lineId);

    if (line === undefined) {
      throw new InvalidLineId();
    }

    const at = new Date(this.clock.now()).toISOString();

    check.markNotDeliverable({ lineId: input.lineId, at });
    await this.diningRoom.saveCheck(check);
    await this.hub.publish({
      kind: "not_restocked",
      tenantId: check.tenantId,
      venueId: check.venueId,
      checkId: check.id,
      tableId: check.tableId,
      productId: line.productId,
      lineIds: [input.lineId],
      at,
    });

    return check;
  }
}
