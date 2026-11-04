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
import { type Check, TableNotOpen } from "#domain/check.js";

export interface ChangePriceInput {
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
  price: number;
  authorizationId: string | null;
}

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  input: ChangePriceInput,
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

// The new price is stored on that line. The menu is not a collaborator.
const recordPriceChange = (
  audits: RecordAuditEvent,
  input: ChangePriceInput,
  previous: number,
): Promise<unknown> =>
  audits.execute({
    tenantId: input.tenantId,
    actorId: input.actorId,
    authorizerId: input.authorizerId,
    deviceId: input.deviceId,
    siteId: input.venueId,
    action: PERMISSION.SALE_CHANGE_PRICE,
    entity: input.lineId,
    before: { value: previous },
    after: {
      value: input.price,
      shiftId: input.shiftId,
      kitchen: null,
    },
    reason: input.reason,
  });

const previousPrice = (check: Check, lineId: string): number =>
  check.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId)?.price ?? 0;

export class ChangePrice {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly shifts: OpenShiftReader,
    private readonly counts: CountExecutedOperations,
    private readonly permissions: EvaluatePermission,
    private readonly grants: ConsumeAuthorization,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: ChangePriceInput): Promise<Check> {
    const check = await loadCheck(this.diningRoom, input);
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
      permission: PERMISSION.SALE_CHANGE_PRICE,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: input.price,
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

    const previous = previousPrice(check, input.lineId);

    check.changePrice({ lineId: input.lineId, price: input.price });
    await this.diningRoom.saveCheck(check);
    await recordPriceChange(this.audits, input, previous);

    return check;
  }

  private async consumeGrant(input: ChangePriceInput): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await this.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission: PERMISSION.SALE_CHANGE_PRICE,
        targetId: input.lineId,
        value: input.price,
      });
    } catch (error: unknown) {
      if (error instanceof UnknownAuthorizationReference) {
        return false;
      }

      throw error;
    }
  }
}
