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
import type { DiningTable } from "#domain/dining-table.js";

interface ReassignCheckBase {
  tenantId: string;
  venueId: string;
  targetCheckId: string;
  sourceCheckId: string;
}

export interface TransferTableInput {
  kind: "transfer-table";
  tenantId: string;
  venueId: string;
  checkId: string;
  waiterId: string;
  actorId: string;
  authorizerId: string | null;
  sessionId: string;
  deviceId: string;
  shiftId: string;
  reason: string;
  authorizationId: string | null;
}

export interface TableTransferGuard {
  shifts: OpenShiftReader;
  counts: CountExecutedOperations;
  permissions: EvaluatePermission;
  grants: ConsumeAuthorization;
  audits: RecordAuditEvent;
}

export type ReassignCheckInput =
  | (ReassignCheckBase & { kind: "join" })
  | (ReassignCheckBase & {
      kind: "transfer";
      lineIds: readonly string[];
    })
  | TransferTableInput;

const loadCheck = async (
  diningRoom: DiningRoomRepository,
  tenantId: string,
  venueId: string,
  checkId: string,
): Promise<Check> => {
  const check = await diningRoom.loadCheck(tenantId, venueId, checkId);

  if (check === null) {
    throw new TableNotOpen();
  }

  return check;
};

const loadTable = async (
  diningRoom: DiningRoomRepository,
  tenantId: string,
  venueId: string,
  tableId: string,
): Promise<DiningTable> => {
  const table = await diningRoom.load(tenantId, venueId, tableId);

  if (table === null) {
    throw new TableNotOpen();
  }

  return table;
};

export class ReassignCheck {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly transfer?: TableTransferGuard,
  ) {}

  async execute(input: ReassignCheckInput): Promise<Check> {
    if (input.kind === "transfer-table") {
      return this.transferTable(input);
    }

    const target = await loadCheck(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      input.targetCheckId,
    );
    const source = await loadCheck(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      input.sourceCheckId,
    );
    const targetTable = await loadTable(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      target.tableId,
    );
    const sourceTable = await loadTable(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      source.tableId,
    );

    if (input.kind === "join") {
      target.join({
        source,
        sourceState: sourceTable.state,
        targetState: targetTable.state,
      });
    } else {
      target.transfer({
        source,
        lineIds: input.lineIds,
        sourceState: sourceTable.state,
        targetState: targetTable.state,
      });
    }

    await this.diningRoom.saveChecks([target, source]);

    return target;
  }

  private async transferTable(input: TransferTableInput): Promise<Check> {
    const check = await loadCheck(
      this.diningRoom,
      input.tenantId,
      input.venueId,
      input.checkId,
    );
    const guard = this.transfer;

    if (guard === undefined) {
      return check;
    }

    const open = await guard.shifts.isOpen({
      tenantId: input.tenantId,
      venueId: input.venueId,
      shiftId: input.shiftId,
    });

    if (!open) {
      return check;
    }

    const value = check.total;
    const shiftTotals = await guard.counts.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      shiftId: input.shiftId,
    });
    const decision = await guard.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.SALE_TRANSFER_TABLE,
      target: { kind: "site", id: input.venueId, brandId: null },
      value,
      supportGrantId: null,
      shiftTotals,
    });

    if (decision.outcome === "denied") {
      return check;
    }

    if (decision.outcome === "requires_authorization") {
      const consumed = await this.consumeTransfer(
        guard,
        input,
        check.id,
        value,
      );

      if (!consumed) {
        return check;
      }
    } else if (decision.outcome !== "allowed") {
      return check;
    }

    const previousWaiter = check.waiterId;

    check.assignWaiter(input.waiterId);
    await this.diningRoom.saveCheck(check);
    await guard.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: input.authorizerId,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: PERMISSION.SALE_TRANSFER_TABLE,
      entity: check.id,
      before: { waiterId: previousWaiter },
      after: {
        value,
        shiftId: input.shiftId,
        kitchen: null,
        waiterId: input.waiterId,
      },
      reason: input.reason,
    });

    return check;
  }

  private async consumeTransfer(
    guard: TableTransferGuard,
    input: TransferTableInput,
    targetId: string,
    value: number,
  ): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await guard.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission: PERMISSION.SALE_TRANSFER_TABLE,
        targetId,
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
