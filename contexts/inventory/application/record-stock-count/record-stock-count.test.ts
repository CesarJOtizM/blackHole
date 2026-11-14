import {
  Authorization,
  EvaluatePermission,
  LimitRaised,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import {
  type IngredientCategory,
  IngredientClassification,
} from "#application/ports/ingredient-classification.js";
import { PublishedPurchaseFactor } from "#application/ports/published-purchase-factor.js";
import {
  type CountLedgerLine,
  type CountSession,
  StockCountRepository,
} from "#application/ports/stock-count-repository.js";
import { RecordStockCount } from "#application/record-stock-count/record-stock-count.js";
import {
  IngredientHidden,
  SetIngredientCategory,
} from "#application/set-ingredient-category/set-ingredient-category.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { COUNT_SCOPE } from "#domain/stock-count.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const MILK_ID = "ingredient_milk";
const CHEESE_ID = "ingredient_cheese";
const BEEF_ID = "ingredient_beef";
const OWNER_ID = "user_owner";
const KITCHEN_CHIEF_ID = "user_kitchen_chief";
const DAIRY = "dairy";
const CUT_OFF = "2026-11-13T18:00:00.000Z";
const BEFORE = "2026-11-13T17:00:00.000Z";
const AFTER = "2026-11-13T19:00:00.000Z";
const LATER = "2026-11-13T20:00:00.000Z";
const AVERAGE_COST = 1_500;
const LATER_COST = 4_500;
const GRAMS_PER_PURCHASE_UNIT = 100;
const COMPANY_CAP = 1_000;

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const movementId = (documentId: string, ingredientId: string): string =>
  `movement_${documentId}_${ingredientId}`;

class MemoryCounts extends StockCountRepository {
  readonly movements: CountLedgerLine[] = [];
  readonly appended: CountLedgerLine[] = [];
  readonly sessions: CountSession[] = [];
  readonly queries: string[] = [];

  seed(line: CountLedgerLine): void {
    this.movements.push(line);
  }

  override async movementsAt(
    tenantId: string,
    venueId: string,
    locationId: string,
  ): Promise<readonly CountLedgerLine[]> {
    this.queries.push(`${tenantId}:${venueId}:${locationId}`);

    return this.movements.filter(
      (line) =>
        line.tenantId === tenantId &&
        line.venueId === venueId &&
        line.locationId === locationId,
    );
  }

  override async appendAdjustments(
    lines: readonly CountLedgerLine[],
  ): Promise<void> {
    for (const line of lines) {
      this.appended.push(line);
      this.movements.push(line);
    }
  }

  override async saveSession(session: CountSession): Promise<void> {
    this.sessions.push(session);
  }
}

class MemoryIngredientClassification extends IngredientClassification {
  private readonly ingredients = new Set<string>();
  private readonly categories = new Map<string, IngredientCategory>();

  know(tenantId: string, ingredientId: string): void {
    this.ingredients.add(this.key(tenantId, ingredientId));
  }

  async ingredientOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<string | null> {
    if (!this.ingredients.has(this.key(tenantId, ingredientId))) {
      return null;
    }

    return ingredientId;
  }

  async save(category: IngredientCategory): Promise<void> {
    this.categories.set(this.key(category.tenantId, category.ingredientId), {
      ...category,
    });
  }

  async find(
    tenantId: string,
    ingredientId: string,
  ): Promise<IngredientCategory | null> {
    return this.categories.get(this.key(tenantId, ingredientId)) ?? null;
  }

  private key(tenantId: string, ingredientId: string): string {
    return `${tenantId}\u0000${ingredientId}`;
  }
}

class MemoryFactors extends PublishedPurchaseFactor {
  private readonly factors = new Map<string, number>();

  remember(tenantId: string, ingredientId: string, factor: number): void {
    this.factors.set(`${tenantId}\u0000${ingredientId}`, factor);
  }

  override async factorOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<number> {
    const factor = this.factors.get(`${tenantId}\u0000${ingredientId}`);

    if (factor === undefined) {
      throw new Error("The purchase factor is not published.");
    }

    return factor;
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

class KitchenCountPermission extends EvaluatePermission {
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

const stockLine = (
  input: Pick<
    CountLedgerLine,
    "id" | "ingredientId" | "quantity" | "occurredAt"
  > &
    Partial<CountLedgerLine>,
): CountLedgerLine => ({
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  unitCost: AVERAGE_COST,
  type: MOVEMENT_TYPE.PURCHASE,
  reference: input.id,
  orderLineId: input.id,
  role: "consumption",
  recipeVersion: 0,
  reason: null,
  actorId: null,
  ...input,
});

const harness = async () => {
  const authorization = Authorization.open(TENANT_A);
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
  const classifications = new MemoryIngredientClassification();
  classifications.know(TENANT_A, MILK_ID);
  classifications.know(TENANT_A, CHEESE_ID);
  classifications.know(TENANT_A, BEEF_ID);
  const setCategory = new SetIngredientCategory(classifications);
  await setCategory.execute({
    tenantId: TENANT_A,
    ingredientId: MILK_ID,
    category: DAIRY,
  });
  await setCategory.execute({
    tenantId: TENANT_A,
    ingredientId: CHEESE_ID,
    category: DAIRY,
  });
  const factors = new MemoryFactors();

  for (const ingredientId of [MILK_ID, CHEESE_ID, BEEF_ID]) {
    factors.remember(TENANT_A, ingredientId, GRAMS_PER_PURCHASE_UNIT);
    factors.remember(TENANT_B, ingredientId, GRAMS_PER_PURCHASE_UNIT);
  }

  const counts = new MemoryCounts();
  counts.seed(
    stockLine({
      id: "movement_milk_opening",
      ingredientId: MILK_ID,
      quantity: grams(8000),
      occurredAt: BEFORE,
    }),
  );
  counts.seed(
    stockLine({
      id: "movement_cheese_opening",
      ingredientId: CHEESE_ID,
      quantity: grams(100),
      unitCost: 4,
      occurredAt: BEFORE,
    }),
  );
  counts.seed(
    stockLine({
      id: "movement_beef_opening",
      ingredientId: BEEF_ID,
      quantity: grams(5000),
      unitCost: 8,
      occurredAt: BEFORE,
    }),
  );
  counts.seed(
    stockLine({
      id: "movement_milk_sale_after",
      ingredientId: MILK_ID,
      quantity: -grams(200),
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      occurredAt: AFTER,
    }),
  );
  counts.seed(
    stockLine({
      id: "movement_milk_purchase_after",
      ingredientId: MILK_ID,
      quantity: grams(1000),
      unitCost: LATER_COST,
      occurredAt: LATER,
    }),
  );
  counts.seed(
    stockLine({
      id: "movement_milk_tenant_b",
      tenantId: TENANT_B,
      ingredientId: MILK_ID,
      quantity: grams(100),
      occurredAt: BEFORE,
    }),
  );
  const audits = new CapturedAudit();
  const useCase = new RecordStockCount(
    new KitchenCountPermission(authorization),
    counts,
    classifications,
    factors,
    audits,
  );

  return { counts, classifications, audits, useCase, setCategory };
};

const command = (documentId: string, milkUnits = 74, siteCap?: number) => ({
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  documentId,
  cutOff: CUT_OFF,
  occurredAt: CUT_OFF,
  scope: COUNT_SCOPE.CATEGORY,
  category: DAIRY,
  lines: [
    { ingredientId: MILK_ID, purchaseQuantity: milkUnits },
    { ingredientId: CHEESE_ID, purchaseQuantity: 1 },
    { ingredientId: BEEF_ID, purchaseQuantity: 10 },
  ],
  actorId: KITCHEN_CHIEF_ID,
  sessionId: "session_kitchen",
  deviceId: "device_kitchen",
  ...(siteCap === undefined ? {} : { siteCap }),
});

it("given a dairy count, when milk is short 600 g at 900 COP under the 1000 COP cap, then one count_adjustment posts at the cut-off snapshot and a later sale is ignored", async () => {
  const documentId = "count_milk_within_cap";
  const { counts, audits, useCase } = await harness();
  const recomputed = nextAverageCost({
    onHand: grams(7800),
    averageCost: AVERAGE_COST,
    receivedQuantity: grams(1000),
    receiptCost: LATER_COST,
  });

  const result = await useCase.execute(command(documentId));

  const posted = counts.appended.find(
    (line) => line.id === movementId(documentId, MILK_ID),
  );
  expect(result).toEqual({
    posted: true,
    valueCop: 900,
    lines: [
      {
        movementId: movementId(documentId, MILK_ID),
        ingredientId: MILK_ID,
        quantity: -grams(600),
        valueCop: 900,
        averageCost: AVERAGE_COST,
      },
    ],
  });
  expect(posted).toEqual({
    id: movementId(documentId, MILK_ID),
    tenantId: TENANT_A,
    venueId: VENUE_ID,
    locationId: LOCATION_ID,
    ingredientId: MILK_ID,
    quantity: -grams(600),
    unitCost: AVERAGE_COST,
    type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    reference: documentId,
    occurredAt: CUT_OFF,
    orderLineId: documentId,
    role: "count_adjustment",
    recipeVersion: 0,
    reason: null,
    actorId: KITCHEN_CHIEF_ID,
  });
  expect(posted).not.toHaveProperty("reversesMovementId");
  expect(posted?.unitCost).toBe(AVERAGE_COST);
  expect(posted?.unitCost).not.toBe(recomputed);
  expect(counts.appended).toHaveLength(1);
  expect(counts.appended.some((line) => line.ingredientId === CHEESE_ID)).toBe(
    false,
  );
  expect(counts.appended.some((line) => line.ingredientId === BEEF_ID)).toBe(
    false,
  );
  expect(
    counts.movements.find((line) => line.id === "movement_milk_sale_after"),
  ).toMatchObject({
    quantity: -grams(200),
    type: MOVEMENT_TYPE.SALE_CONSUMPTION,
  });
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_A,
      actorId: KITCHEN_CHIEF_ID,
      authorizerId: null,
      deviceId: "device_kitchen",
      siteId: VENUE_ID,
      action: PERMISSION.INVENTORY_COUNT,
      entity: documentId,
      before: { averageCost: AVERAGE_COST },
      after: {
        movementId: movementId(documentId, MILK_ID),
        quantity: -grams(600),
        valueCop: 900,
      },
      reason: DAIRY,
    },
  ]);
});

it("given a variance valued at 1500 COP and a 1000 COP cap, when the count is submitted, then no count_adjustment is posted", async () => {
  const documentId = "count_milk_over_cap";
  const { counts, audits, useCase } = await harness();
  const before = counts.movements.map((line) => line.id);

  const result = await useCase.execute(command(documentId, 70));

  expect(result).toEqual({
    posted: false,
    outcome: "requires_authorization",
    exceededLimit: {
      code: "countAdjustmentCop",
      cap: COMPANY_CAP,
      unit: "cop",
    },
  });
  expect(counts.appended).toEqual([]);
  expect(counts.movements.map((line) => line.id)).toEqual(before);
  expect(counts.sessions).toEqual([
    {
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      locationId: LOCATION_ID,
      documentId,
      cutOff: CUT_OFF,
      status: "pending",
      lines: [
        {
          ingredientId: MILK_ID,
          quantity: -grams(1000),
          averageCost: AVERAGE_COST,
          valueCop: 1_500,
        },
      ],
      valueCop: 1_500,
    },
  ]);
  expect(audits.commands).toEqual([]);
});

it("given the 1000 COP company cap, when a site raises it, then LimitRaised rejects the count", async () => {
  const documentId = "count_milk_raised_cap";
  const { counts, audits, useCase } = await harness();
  const before = counts.movements.map((line) => line.id);

  const raised = useCase.execute(command(documentId, 74, 2_000));

  await expect(raised).rejects.toThrow(LimitRaised);
  expect(counts.appended).toEqual([]);
  expect(counts.sessions).toEqual([]);
  expect(counts.movements.map((line) => line.id)).toEqual(before);
  expect(audits.commands).toEqual([]);
});

it("given a site cap lowered to 500 COP, when the variance is 900 COP, then no count_adjustment is posted", async () => {
  const documentId = "count_milk_lowered_cap";
  const { counts, audits, useCase } = await harness();

  const result = await useCase.execute(command(documentId, 74, 500));

  expect(result).toEqual({
    posted: false,
    outcome: "requires_authorization",
    exceededLimit: { code: "countAdjustmentCop", cap: 500, unit: "cop" },
  });
  expect(counts.appended).toEqual([]);
  expect(audits.commands).toEqual([]);
});

it("given milk classified as dairy for one company, when another company counts that ingredient, then it stays hidden", async () => {
  const documentId = "count_milk_hidden_tenant";
  const { counts, classifications, useCase, setCategory } = await harness();

  const hidden = setCategory.execute({
    tenantId: TENANT_B,
    ingredientId: MILK_ID,
    category: "meat",
  });

  await expect(hidden).rejects.toThrow(IngredientHidden);
  const result = await useCase.execute({
    ...command(documentId),
    tenantId: TENANT_B,
  });

  expect(result).toEqual({ posted: true, valueCop: 0, lines: [] });
  expect(counts.appended).toEqual([]);
  expect(counts.queries).toContain(`${TENANT_B}:${VENUE_ID}:${LOCATION_ID}`);
  expect(await classifications.find(TENANT_B, MILK_ID)).toBeNull();
  expect(await classifications.ingredientOf(TENANT_B, MILK_ID)).toBeNull();
  expect(await classifications.find(TENANT_A, MILK_ID)).toEqual({
    tenantId: TENANT_A,
    ingredientId: MILK_ID,
    category: DAIRY,
  });
  expect(
    counts.movements.some(
      (line) =>
        line.tenantId === TENANT_B &&
        line.type === MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    ),
  ).toBe(false);
});
