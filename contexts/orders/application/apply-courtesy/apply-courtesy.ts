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

export interface ApplyCourtesyInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  shiftId: string;
  reason: string;
  value: number;
  authorizationId: string | null;
}

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  input: ApplyCourtesyInput,
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

// Check has no courtesy operation. The amount is stored on the audit.
// Line prices stay and the account is not cleared.
const recordCourtesy = (
  audits: RecordAuditEvent,
  input: ApplyCourtesyInput,
): Promise<unknown> =>
  audits.execute({
    tenantId: input.tenantId,
    actorId: input.actorId,
    authorizerId: input.authorizerId,
    deviceId: input.deviceId,
    siteId: input.venueId,
    action: PERMISSION.SALE_COMP,
    entity: input.checkId,
    before: { value: 0 },
    after: {
      value: input.value,
      shiftId: input.shiftId,
      kitchen: null,
    },
    reason: input.reason,
  });

export class ApplyCourtesy {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly shifts: OpenShiftReader,
    private readonly counts: CountExecutedOperations,
    private readonly permissions: EvaluatePermission,
    private readonly grants: ConsumeAuthorization,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: ApplyCourtesyInput): Promise<Check> {
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
      permission: PERMISSION.SALE_COMP,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: input.value,
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

    await recordCourtesy(this.audits, input);

    return check;
  }

  private async consumeGrant(input: ApplyCourtesyInput): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await this.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission: PERMISSION.SALE_COMP,
        targetId: input.checkId,
        value: input.value,
      });
    } catch (error: unknown) {
      if (error instanceof UnknownAuthorizationReference) {
        return false;
      }

      throw error;
    }
  }
}
