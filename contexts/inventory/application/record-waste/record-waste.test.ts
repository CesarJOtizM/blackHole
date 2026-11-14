import {
  RecordAuditEvent,
  StaleGeneration,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import { OperationGeneration } from "#application/ports/operation-generation.js";
import {
  type AppendStock,
  CONSUMPTION_ROLE,
  type LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import type { StockMovementEnvelope } from "#application/ports/stock-movement-queue.js";
import { StockMovementQueue } from "#application/ports/stock-movement-queue.js";
import { RecordWaste } from "#application/record-waste/record-waste.js";
import { LineReversalConflict } from "#application/return-stock/return-stock.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const BEEF_ID = "ingredient_beef";
const LINE_ID = "order_line_burger";
const ACTOR_ID = "user_cook";
const REASON = "customer left";
const GENERATION = 1;
const SENT_AT = "2026-11-13T18:00:00.000Z";
const WASTED_AT = "2026-11-13T18:20:00.000Z";
const BEEF_COST = 180_000;
const OTHER_COST = 1;

const grams = (value: number): number => value * QUANTITY_SCALE;

class MemoryLedger extends StockLedgerRepository {
  readonly lines: LedgerLine[] = [];
  private readonly balances = new Map<string, number>();

  seed(line: LedgerLine): void {
    this.lines.push(line);
    const key = `${line.tenantId}:${line.locationId}:${line.ingredientId}`;
    this.balances.set(key, (this.balances.get(key) ?? 0) + line.quantity);
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
    return this.balances.get(`${tenantId}:${locationId}:${ingredientId}`) ?? 0;
  }

  override async hasOpenAlert(): Promise<boolean> {
    return false;
  }

  override async append(input: AppendStock): Promise<void> {
    for (const movement of input.movements) {
      const key = `${movement.tenantId}:${movement.locationId}:${movement.ingredientId}`;
      this.balances.set(key, (this.balances.get(key) ?? 0) + movement.quantity);
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

class FixedGeneration extends OperationGeneration {
  constructor(private readonly current: number) {
    super();
  }

  override async assertCurrent(
    _tenantId: string,
    _venueId: string,
    generation: number,
  ): Promise<void> {
    if (generation !== this.current) {
      throw new StaleGeneration();
    }
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

const consumption = (): LedgerLine => ({
  id: `movement_${LINE_ID}_consumption_${BEEF_ID}`,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId: BEEF_ID,
  quantity: grams(-300),
  unitCost: BEEF_COST,
  type: MOVEMENT_TYPE.SALE_CONSUMPTION,
  reference: LINE_ID,
  occurredAt: SENT_AT,
  orderLineId: LINE_ID,
  role: CONSUMPTION_ROLE.CONSUMPTION,
  recipeVersion: 4,
  reason: null,
  actorId: null,
});

const command = (generation = GENERATION) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  generation,
  orderLineId: LINE_ID,
  productId: "product_burger",
  variantIds: [] as readonly string[],
  modifierIds: [] as readonly string[],
  portions: 2,
  occurredAt: WASTED_AT,
  actorId: ACTOR_ID,
  reason: REASON,
});

const build = () => {
  const ledger = new MemoryLedger();
  const queue = new MemoryQueue();
  const audit = new CapturedAudit();
  const record = new RecordWaste(
    new FixedGeneration(GENERATION),
    ledger,
    queue,
    audit,
  );

  return { ledger, queue, audit, record };
};

it("given a line consumed at version 4, when it is wasted after start, then waste stores reason and actor, keeps version 4 and unit cost, and does not return stock", async () => {
  const { ledger, queue, audit, record } = build();
  ledger.seed(consumption());

  const result = await record.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  const wasted = ledger.lines.find((line) => line.type === MOVEMENT_TYPE.WASTE);
  expect(wasted).toMatchObject({
    ingredientId: BEEF_ID,
    quantity: grams(-300),
    unitCost: BEEF_COST,
    recipeVersion: 4,
    role: CONSUMPTION_ROLE.REVERSAL,
    reason: REASON,
    actorId: ACTOR_ID,
    occurredAt: WASTED_AT,
  });
  expect(
    ledger.lines.some((line) => line.type === MOVEMENT_TYPE.SALE_RETURN),
  ).toBe(false);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, BEEF_ID)).toBe(
    grams(-600),
  );
  expect(queue.envelopes).toEqual([
    expect.objectContaining({
      lane: "after_sales",
      key: wasted?.id,
      event: expect.objectContaining({
        type: "StockMoved",
        movementType: MOVEMENT_TYPE.WASTE,
        unitCost: BEEF_COST,
        recipeVersion: 4,
        quantity: grams(-300),
      }),
    }),
  ]);
  expect(audit.commands).toEqual([
    expect.objectContaining({
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: VENUE_ID,
      siteId: VENUE_ID,
      action: "inventory.record-waste",
      entity: LINE_ID,
      reason: REASON,
    }),
  ]);
});

it("given waste already recorded, when it is redelivered, then nothing new is recorded and the audit is not repeated", async () => {
  const { ledger, queue, audit, record } = build();
  ledger.seed(consumption());
  await record.execute(command());
  const movements = ledger.lines.length;
  const queued = queue.envelopes.length;

  const result = await record.execute(command());

  expect(result).toEqual({ missingRecipe: false });
  expect(ledger.lines).toHaveLength(movements);
  expect(queue.envelopes).toHaveLength(queued);
  expect(audit.commands).toHaveLength(1);
});

it("given the line was already returned, when waste is requested, then LineReversalConflict carries the stored unit cost and nothing is audited", async () => {
  const { ledger, queue, audit, record } = build();
  ledger.seed(consumption());
  ledger.seed({
    id: `movement_${LINE_ID}_reversal_${BEEF_ID}`,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    locationId: LOCATION_ID,
    ingredientId: BEEF_ID,
    quantity: grams(300),
    unitCost: OTHER_COST,
    type: MOVEMENT_TYPE.SALE_RETURN,
    reference: LINE_ID,
    occurredAt: WASTED_AT,
    orderLineId: LINE_ID,
    role: CONSUMPTION_ROLE.REVERSAL,
    recipeVersion: 4,
    reason: null,
    actorId: null,
    reversesMovementId: `movement_${LINE_ID}_consumption_${BEEF_ID}`,
  });
  const movements = ledger.lines.length;

  const pending = record.execute(command());

  await expect(pending).rejects.toBeInstanceOf(LineReversalConflict);
  await expect(pending).rejects.toMatchObject({ unitCost: BEEF_COST });
  expect(ledger.lines).toHaveLength(movements);
  expect(ledger.lines.some((line) => line.type === MOVEMENT_TYPE.WASTE)).toBe(
    false,
  );
  expect(queue.envelopes).toHaveLength(0);
  expect(audit.commands).toHaveLength(0);
});

it("given the current generation, when waste arrives with another generation, then StaleGeneration is thrown and nothing is audited", async () => {
  const { ledger, audit, record } = build();
  ledger.seed(consumption());

  await expect(record.execute(command(GENERATION + 1))).rejects.toBeInstanceOf(
    StaleGeneration,
  );
  expect(ledger.lines).toHaveLength(1);
  expect(audit.commands).toHaveLength(0);
});
