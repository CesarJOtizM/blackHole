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
import { Check, TableNotOpen } from "#domain/check.js";

export interface VoidAccountInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  shiftId: string;
  reason: string;
  authorizationId: string | null;
}

const accountValue = (check: Check): number =>
  check.orders
    .flatMap((order) => order.lines)
    .reduce((sum, line) => sum + line.price, 0);

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  input: VoidAccountInput,
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

// Check has no void. Release only marks the table to_clean, which is the paid
// lifecycle. This replacement drops the account's lines without a sink check.
const clearAccount = (check: Check): Check =>
  Check.open({
    id: check.id,
    tenantId: check.tenantId,
    venueId: check.venueId,
    tableId: check.tableId,
    openedAt: check.openedAt,
  });

export class VoidAccount {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly shifts: OpenShiftReader,
    private readonly counts: CountExecutedOperations,
    private readonly permissions: EvaluatePermission,
    private readonly grants: ConsumeAuthorization,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(input: VoidAccountInput): Promise<Check> {
    const check = await loadCheck(this.diningRoom, input);
    const open = await this.shifts.isOpen({
      tenantId: input.tenantId,
      venueId: input.venueId,
      shiftId: input.shiftId,
    });

    if (!open) {
      return check;
    }

    const value = accountValue(check);
    const shiftTotals = await this.counts.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      shiftId: input.shiftId,
    });
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.SALE_VOID_ACCOUNT,
      target: { kind: "site", id: input.venueId, brandId: null },
      value,
      supportGrantId: null,
      shiftTotals,
    });

    if (decision.outcome === "denied") {
      return check;
    }

    if (decision.outcome === "requires_authorization") {
      const consumed = await this.consumeGrant(input, value);

      if (!consumed) {
        return check;
      }
    }

    const cleared = clearAccount(check);
    await this.diningRoom.saveCheck(cleared);
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: input.authorizerId,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: PERMISSION.SALE_VOID_ACCOUNT,
      entity: input.checkId,
      before: { value },
      after: {
        value,
        shiftId: input.shiftId,
        kitchen: null,
      },
      reason: input.reason,
    });

    return cleared;
  }

  private async consumeGrant(
    input: VoidAccountInput,
    value: number,
  ): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await this.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission: PERMISSION.SALE_VOID_ACCOUNT,
        targetId: input.checkId,
        value,
      });
    } catch (error: unknown) {
      if (error instanceof UnknownAuthorizationReference) {
        return false;
      }

      throw error;
    }
  }
}
