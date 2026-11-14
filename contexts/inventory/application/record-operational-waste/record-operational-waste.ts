import {
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";

import {
  CONSUMPTION_ROLE,
  type LedgerLine,
  type StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import {
  STOCK_MOVEMENT_LANE,
  type StockMovementQueue,
  stockMovedEvent,
} from "#application/ports/stock-movement-queue.js";
import {
  type OperationalWaste,
  recordOperationalWaste,
  type WasteReason,
} from "#domain/operational-waste.js";
import { StockLedger } from "#domain/stock-ledger.js";

export interface RecordOperationalWasteInput {
  tenantId: string;
  venueId: string;
  locationId: string;
  ingredientId: string;
  documentId: string;
  quantity: number;
  averageCost: number;
  reason?: string;
  note?: string;
  occurredAt: string;
  actorId: string;
  sessionId: string;
  deviceId: string;
  authorizerId: string | null;
}

export interface PostedOperationalWaste {
  posted: true;
  movementId: string;
  quantity: number;
  valueCop: number;
  averageCost: number;
  reason: WasteReason;
}

export interface OperationalWasteNeedsAuthorizer {
  posted: false;
  outcome: "requires_authorization";
  exceededLimit: { code: string; cap: number; unit: string } | null;
}

export interface OperationalWasteDenied {
  posted: false;
  outcome: "denied";
}

export type RecordOperationalWasteResult =
  | PostedOperationalWaste
  | OperationalWasteNeedsAuthorizer
  | OperationalWasteDenied;

const lineId = (documentId: string, ingredientId: string): string =>
  `movement_${documentId}_${ingredientId}`;

export class RecordOperationalWaste {
  constructor(
    private readonly permissions: EvaluatePermission,
    private readonly ledger: StockLedgerRepository,
    private readonly queue: StockMovementQueue,
    private readonly audits: RecordAuditEvent,
  ) {}

  async execute(
    input: RecordOperationalWasteInput,
  ): Promise<RecordOperationalWasteResult> {
    // The recorded amount is a positive count of base units.
    // Average cost is copied. This path does not recompute it.
    const waste = recordOperationalWaste({
      locationId: input.locationId,
      ingredientId: input.ingredientId,
      quantity: -input.quantity,
      averageCost: input.averageCost,
      reason: input.reason,
      note: input.note,
    });
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.INVENTORY_RECORD_WASTE,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: waste.valueCop,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome === "requires_authorization") {
      return {
        posted: false,
        outcome: "requires_authorization",
        exceededLimit: decision.exceededLimit,
      };
    }

    if (decision.outcome !== "allowed") {
      return { posted: false, outcome: "denied" };
    }

    const movement = postedLine(input, waste);
    StockLedger.open({
      tenantId: input.tenantId,
      locationId: input.locationId,
    }).append({
      id: movement.id,
      ingredientId: movement.ingredientId,
      quantity: movement.quantity,
      unitCost: movement.unitCost,
      type: movement.type,
      reference: movement.reference,
      occurredAt: movement.occurredAt,
    });
    await this.ledger.append({ movements: [movement], alerts: [] });
    await this.queue.enqueue({
      lane: STOCK_MOVEMENT_LANE,
      key: movement.id,
      event: stockMovedEvent(movement),
    });
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: null,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: PERMISSION.INVENTORY_RECORD_WASTE,
      entity: input.documentId,
      before: { averageCost: waste.averageCost },
      after: {
        movementId: movement.id,
        quantity: waste.quantity,
        valueCop: waste.valueCop,
      },
      reason: waste.reason,
    });

    return {
      posted: true,
      movementId: movement.id,
      quantity: waste.quantity,
      valueCop: waste.valueCop,
      averageCost: waste.averageCost,
      reason: waste.reason,
    };
  }
}

function postedLine(
  input: RecordOperationalWasteInput,
  waste: OperationalWaste,
): LedgerLine {
  return {
    id: lineId(input.documentId, input.ingredientId),
    tenantId: input.tenantId,
    venueId: input.venueId,
    locationId: waste.locationId,
    ingredientId: waste.ingredientId,
    quantity: waste.quantity,
    unitCost: waste.averageCost,
    type: waste.type,
    reference: input.documentId,
    occurredAt: input.occurredAt,
    orderLineId: input.documentId,
    role: CONSUMPTION_ROLE.OPERATIONAL_WASTE,
    recipeVersion: 0,
    reason: waste.reason,
    actorId: input.actorId,
  };
}
