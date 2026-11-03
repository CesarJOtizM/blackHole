import {
  type ConsumeAuthorization,
  type CountExecutedOperations,
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
  UnknownAuthorizationReference,
} from "@blackhole/platform/application/entry-port";

import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import type { OpenShiftReader } from "#application/ports/open-shift-reader.js";
import {
  Check,
  InvalidLineId,
  type LineState,
  TableNotOpen,
} from "#domain/check.js";

const VOID_VALUE = 1;
const SINK_CHECK_ID = "check_void_sink";

export interface VoidLineInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  lineId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  shiftId: string;
  reason: string;
  authorizationId: string | null;
}

const beforeKitchen = (state: LineState): boolean =>
  state === "held" || state === "sent";

const findLine = (check: Check, lineId: string) =>
  check.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId);

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  input: VoidLineInput,
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

const detachLine = (check: Check, lineId: string): void => {
  const sink = Check.open({
    id: SINK_CHECK_ID,
    tenantId: check.tenantId,
    venueId: check.venueId,
    tableId: check.tableId,
    openedAt: check.openedAt,
  });

  sink.transfer({
    source: check,
    lineIds: [lineId],
    sourceState: check.tableState,
    targetState: sink.tableState,
  });
};

export class VoidLine {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly shifts: OpenShiftReader,
    private readonly counts: CountExecutedOperations,
    private readonly permissions: EvaluatePermission,
    private readonly grants: ConsumeAuthorization,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: VoidLineInput): Promise<Check> {
    const check = await loadCheck(this.diningRoom, input);
    const line = findLine(check, input.lineId);

    if (line === undefined) {
      throw new InvalidLineId();
    }

    if (!beforeKitchen(line.state)) {
      return check;
    }

    const open = await this.shifts.isOpen({
      tenantId: input.tenantId,
      venueId: input.venueId,
      shiftId: input.shiftId,
    });

    if (!open) {
      return check;
    }

    const shiftTotals = await this.counts.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      shiftId: input.shiftId,
    });
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: VOID_VALUE,
      supportGrantId: null,
      shiftTotals,
    });

    if (decision.outcome === "denied") {
      return check;
    }

    if (decision.outcome === "requires_authorization") {
      const consumed = await this.consumeGrant(input);

      if (!consumed) {
        return check;
      }
    }

    const state = line.state;
    detachLine(check, input.lineId);
    await this.diningRoom.saveCheck(check);
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: input.authorizerId,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
      entity: input.lineId,
      before: { state },
      after: {
        value: VOID_VALUE,
        shiftId: input.shiftId,
        kitchen: "before",
      },
      reason: input.reason,
    });

    return check;
  }

  private async consumeGrant(input: VoidLineInput): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await this.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission: PERMISSION.SALE_VOID_BEFORE_KITCHEN,
        targetId: input.lineId,
        value: VOID_VALUE,
      });
    } catch (error: unknown) {
      if (error instanceof UnknownAuthorizationReference) {
        return false;
      }

      throw error;
    }
  }
}
