import {
  Authorization,
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import {
  type AppendStock,
  CONSUMPTION_ROLE,
  type LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import type { StockMovementEnvelope } from "#application/ports/stock-movement-queue.js";
import {
  STOCK_MOVEMENT_LANE,
  StockMovementQueue,
} from "#application/ports/stock-movement-queue.js";
import { RecordOperationalWaste } from "#application/record-operational-waste/record-operational-waste.js";
import { WASTE_REASON } from "#domain/operational-waste.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  MOVEMENT_TYPE,
  nextAverageCost,
  StockLedger,
} from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const MILK_ID = "ingredient_milk";
const OWNER_ID = "user_owner";
const KITCHEN_CHIEF_ID = "user_kitchen_chief";
const OCCURRED_AT = "2026-11-13T12:00:00.000Z";
const AVERAGE_COST = 4;

const millilitres = (quantity: number): number => quantity * QUANTITY_SCALE;

const movementId = (documentId: string): string =>
  `movement_${documentId}_${MILK_ID}`;

class MemoryLedger extends StockLedgerRepository {
  readonly lines: LedgerLine[] = [];

  seed(line: LedgerLine): void {
    this.lines.push(line);
  }

  override async findLine(
    tenantId: string,
    orderLineId: string,
    role: LedgerLine["role"],
  ): Promise<readonly LedgerLine[]> {
    return this.lines.filter(
      (line) =>
        line.tenantId === tenantId &&
        line.orderLineId === orderLineId &&
        line.role === role,
    );
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    const ledger = StockLedger.open({ tenantId, locationId });

    for (const line of this.lines) {
      if (line.tenantId !== tenantId || line.locationId !== locationId) {
        continue;
      }

      ledger.append({
        id: line.id,
        ingredientId: line.ingredientId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        type: line.type,
        reference: line.reference,
        occurredAt: line.occurredAt,
        ...(line.reversesMovementId === undefined
          ? {}
          : { reversesMovementId: line.reversesMovementId }),
      });
    }

    return ledger.balance(ingredientId);
  }

  override async hasOpenAlert(): Promise<boolean> {
    return false;
  }

  override async append(input: AppendStock): Promise<void> {
    for (const movement of input.movements) {
      this.lines.push(movement);
    }
  }
}

class MemoryQueue extends StockMovementQueue {
  readonly envelopes: StockMovementEnvelope[] = [];

  override async enqueue(envelope: StockMovementEnvelope): Promise<void> {
    this.envelopes.push(envelope);
  }
}

class CapturedAudit extends RecordAuditEvent {
  readonly commands: Array<Parameters<RecordAuditEvent["execute"]>[0]> = [];

  constructor() {
    super(
      { list: async () => [], append: async () => undefined } as never,
      { digest: async () => "" } as never,
      { now: () => 0 } as never,
    );
  }

  override execute(
    command: Parameters<RecordAuditEvent["execute"]>[0],
  ): ReturnType<RecordAuditEvent["execute"]> {
    this.commands.push(command);
    return Promise.resolve(
      {} as Awaited<ReturnType<RecordAuditEvent["execute"]>>,
    );
  }
}

class KitchenCapPermission extends EvaluatePermission {
  constructor(private readonly authorization: Authorization) {
    super({} as never, {} as never, {} as never, {} as never);
  }

  override execute(
    input: Parameters<EvaluatePermission["execute"]>[0],
  ): ReturnType<EvaluatePermission["execute"]> {
    return Promise.resolve(
      this.authorization.evaluateFor(KITCHEN_CHIEF_ID, {
        permission: input.permission,
        at: 0,
        target: input.target,
        value: input.value,
        shiftTotals: input.shiftTotals,
        selfAuthorizationAttempt: input.selfAuthorizationAttempt ?? false,
        shiftId: null,
      }),
    );
  }
}

const opening = (): LedgerLine => ({
  id: "movement_opening_milk",
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId: MILK_ID,
  quantity: millilitres(5000),
  unitCost: AVERAGE_COST,
  type: MOVEMENT_TYPE.PURCHASE,
  reference: "receipt_opening",
  occurredAt: "2026-11-01T12:00:00.000Z",
  orderLineId: "receipt_opening",
  role: CONSUMPTION_ROLE.CONSUMPTION,
  recipeVersion: 0,
  reason: null,
  actorId: null,
});

const harness = () => {
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.assign({
    assignmentId: "assignment_kitchen",
    userId: KITCHEN_CHIEF_ID,
    roleId: "kitchenChief",
    scopeKind: "site",
    scopeId: VENUE_ID,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });
  const ledger = new MemoryLedger();
  ledger.seed(opening());
  const queue = new MemoryQueue();
  const audits = new CapturedAudit();
  const useCase = new RecordOperationalWaste(
    new KitchenCapPermission(authorization),
    ledger,
    queue,
    audits,
  );

  return { ledger, queue, audits, useCase };
};

const command = (
  quantity: number,
  documentId: string,
  authorizerId: string | null = null,
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId: MILK_ID,
  documentId,
  quantity,
  averageCost: AVERAGE_COST,
  reason: WASTE_REASON.EXPIRED,
  occurredAt: OCCURRED_AT,
  actorId: KITCHEN_CHIEF_ID,
  sessionId: "session_kitchen",
  deviceId: "device_kitchen",
  authorizerId,
});

it("given milk at 4 COP/ml, when 1000 ml is recorded as expired, then quantity -1000 ml valued 4000 COP posts as waste with role operational_waste and on-hand drops", async () => {
  const documentId = "waste_milk_expired";
  const { ledger, queue, useCase } = harness();
  const before = await ledger.balance(TENANT_ID, LOCATION_ID, MILK_ID);
  const recomputed = nextAverageCost({
    onHand: before,
    averageCost: AVERAGE_COST,
    receivedQuantity: millilitres(1000),
    receiptCost: 10,
  });

  const result = await useCase.execute(command(millilitres(1000), documentId));

  const posted = ledger.lines.find(
    (line) => line.id === movementId(documentId),
  );
  expect(before).toBe(millilitres(5000));
  expect(result).toEqual({
    posted: true,
    movementId: movementId(documentId),
    quantity: -millilitres(1000),
    valueCop: 4000,
    averageCost: AVERAGE_COST,
    reason: WASTE_REASON.EXPIRED,
  });
  expect(posted).toEqual({
    id: movementId(documentId),
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    locationId: LOCATION_ID,
    ingredientId: MILK_ID,
    quantity: -millilitres(1000),
    unitCost: AVERAGE_COST,
    type: MOVEMENT_TYPE.WASTE,
    reference: documentId,
    occurredAt: OCCURRED_AT,
    orderLineId: documentId,
    role: "operational_waste",
    recipeVersion: 0,
    reason: WASTE_REASON.EXPIRED,
    actorId: KITCHEN_CHIEF_ID,
  });
  expect(posted).not.toHaveProperty("reversesMovementId");
  expect(posted?.unitCost).toBe(AVERAGE_COST);
  expect(posted?.unitCost).not.toBe(recomputed);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, MILK_ID)).toBe(
    millilitres(4000),
  );
  expect(queue.envelopes).toEqual([
    {
      lane: STOCK_MOVEMENT_LANE,
      key: movementId(documentId),
      event: {
        type: "StockMoved",
        movementId: movementId(documentId),
        tenantId: TENANT_ID,
        venueId: VENUE_ID,
        locationId: LOCATION_ID,
        ingredientId: MILK_ID,
        quantity: -millilitres(1000),
        unitCost: AVERAGE_COST,
        movementType: MOVEMENT_TYPE.WASTE,
        orderLineId: documentId,
        recipeVersion: 0,
        occurredAt: OCCURRED_AT,
        role: "operational_waste",
      },
    },
  ]);
});

it("given a 30000 COP waste cap, when 12000 COP is recorded, then it posts and is audited", async () => {
  const documentId = "waste_milk_within_cap";
  const { ledger, audits, useCase } = harness();

  const result = await useCase.execute(command(millilitres(3000), documentId));

  expect(result).toMatchObject({
    posted: true,
    quantity: -millilitres(3000),
    valueCop: 12_000,
    averageCost: AVERAGE_COST,
  });
  expect(ledger.lines.some((line) => line.id === movementId(documentId))).toBe(
    true,
  );
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: KITCHEN_CHIEF_ID,
      authorizerId: null,
      deviceId: "device_kitchen",
      siteId: VENUE_ID,
      action: PERMISSION.INVENTORY_RECORD_WASTE,
      entity: documentId,
      before: { averageCost: AVERAGE_COST },
      after: {
        movementId: movementId(documentId),
        quantity: -millilitres(3000),
        valueCop: 12_000,
      },
      reason: WASTE_REASON.EXPIRED,
    },
  ]);
});

it("given the same 30000 COP cap, when 45000 COP is recorded by the chief, then another authorizer is required and nothing is posted", async () => {
  const documentId = "waste_milk_over_cap";
  const { ledger, queue, audits, useCase } = harness();
  const before = ledger.lines.map((line) => line.id);

  const result = await useCase.execute(
    command(millilitres(11250), documentId, KITCHEN_CHIEF_ID),
  );

  expect(result).toEqual({
    posted: false,
    outcome: "requires_authorization",
    exceededLimit: { code: "wasteCop", cap: 30_000, unit: "cop" },
  });
  expect(ledger.lines.map((line) => line.id)).toEqual(before);
  expect(queue.envelopes).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, MILK_ID)).toBe(
    millilitres(5000),
  );
});
