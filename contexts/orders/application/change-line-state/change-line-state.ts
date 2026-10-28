import type { Clock } from "#application/ports/clock.js";
import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { RealtimeHub } from "#application/ports/realtime-hub.js";
import { type Check, type LineState, TableNotOpen } from "#domain/check.js";

export interface ChangeLineStateInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  lineId: string;
  state: LineState;
}

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  input: ChangeLineStateInput,
): Promise<Check> => {
  const check = await diningRoom.loadCheck(
    input.tenantId,
    input.venueId,
    input.checkId,
  );

  if (check === null) {
    throw new TableNotOpen();
  }

  return check;
};

export class ChangeLineState {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly clock: Clock,
    private readonly hub: RealtimeHub,
  ) {}

  async execute(input: ChangeLineStateInput): Promise<Check> {
    const check = await loadCheck(this.diningRoom, input);
    const at = new Date(this.clock.now()).toISOString();

    check.advance({
      lineId: input.lineId,
      state: input.state,
      at,
    });
    await this.diningRoom.saveCheck(check);

    if (input.state !== "ready") {
      return check;
    }

    const notice = check.readyNotices[check.readyNotices.length - 1];

    if (notice === undefined) {
      return check;
    }

    await this.hub.publish({
      kind: "line_ready",
      tenantId: check.tenantId,
      venueId: check.venueId,
      checkId: check.id,
      tableId: notice.tableId,
      lineId: notice.lineId,
      at: notice.at,
    });

    return check;
  }
}
