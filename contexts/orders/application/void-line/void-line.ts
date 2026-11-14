import type {
  RecordWasteInput,
  ReturnStockInput,
  SaleStockResult,
} from "@blackhole/inventory/application/entry-port";
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

export interface SaleReversal {
  saleConsumptionEnabled: boolean;
  returnStock: {
    execute(input: ReturnStockInput): Promise<SaleStockResult>;
  };
  recordWaste: {
    execute(input: RecordWasteInput): Promise<SaleStockResult>;
  };
  generationOf(tenantId: string, venueId: string): Promise<number>;
}

type VoidPermission =
  | typeof PERMISSION.SALE_VOID_BEFORE_KITCHEN
  | typeof PERMISSION.SALE_VOID_AFTER_KITCHEN;

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
    private readonly saleConsumption?: SaleReversal,
  ) {}

  async execute(input: VoidLineInput): Promise<Check> {
    const check = await loadCheck(this.diningRoom, input);
    const line = findLine(check, input.lineId);

    if (line === undefined) {
      throw new InvalidLineId();
    }

    const afterStart = !beforeKitchen(line.state);
    const permission = afterStart
      ? PERMISSION.SALE_VOID_AFTER_KITCHEN
      : PERMISSION.SALE_VOID_BEFORE_KITCHEN;
    const value = afterStart ? line.price : VOID_VALUE;
    const kitchen = afterStart ? "after" : "before";
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
      permission,
      target: { kind: "site", id: input.venueId, brandId: null },
      value,
      supportGrantId: null,
      shiftTotals,
    });

    if (decision.outcome === "denied") {
      return check;
    }

    if (decision.outcome === "requires_authorization") {
      const consumed = await this.consumeGrant(input, permission, value);

      if (!consumed) {
        return check;
      }
    }

    const stockLine = {
      state: line.state,
      productId: line.productId,
      variantIds: [...(line.variantIds ?? [])],
      modifierIds: [...(line.modifierIds ?? [])],
    };

    detachLine(check, input.lineId);
    await this.reverseConsumption(input, stockLine);
    await this.diningRoom.saveCheck(check);
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: input.authorizerId,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: permission,
      entity: input.lineId,
      before: { state: stockLine.state },
      after: {
        value,
        shiftId: input.shiftId,
        kitchen,
      },
      reason: input.reason,
    });

    return check;
  }

  private async reverseConsumption(
    input: VoidLineInput,
    line: {
      state: LineState;
      productId: string;
      variantIds: readonly string[];
      modifierIds: readonly string[];
    },
  ): Promise<void> {
    const sale = this.saleConsumption;

    if (sale?.saleConsumptionEnabled !== true || line.state === "held") {
      return;
    }

    const generation = await sale.generationOf(input.tenantId, input.venueId);
    const command = {
      tenantId: input.tenantId,
      venueId: input.venueId,
      generation,
      orderLineId: input.lineId,
      productId: line.productId,
      variantIds: [...line.variantIds],
      modifierIds: [...line.modifierIds],
      portions: 1,
      occurredAt: new Date().toISOString(),
    };

    if (line.state === "sent") {
      await sale.returnStock.execute(command);
      return;
    }

    await sale.recordWaste.execute({
      ...command,
      actorId: input.actorId,
      reason: input.reason,
    });
  }

  private async consumeGrant(
    input: VoidLineInput,
    permission: VoidPermission,
    value: number,
  ): Promise<boolean> {
    if (input.authorizationId === null) {
      return false;
    }

    try {
      return await this.grants.execute({
        tenantId: input.tenantId,
        authorizationId: input.authorizationId,
        permission,
        targetId: input.lineId,
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
