import {
  ConsumeAuthorization,
  type ConsumeAuthorizationInput,
  EvaluatePermission,
  PERMISSION,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  CorrectProduction,
  ProductionCorrectionDenied,
  UnknownProductionRun,
} from "#application/correct-production/correct-production.js";
import type {
  AppendProduction,
  AppendProductionCompensation,
  RecordedProductionRun,
} from "#application/ports/production-repository.js";
import { ProductionRepository } from "#application/ports/production-repository.js";
import { ProductionAlreadyCompensated } from "#domain/production.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const ONION_ID = "ingredient_onion";
const SAUCE_ID = "recipe_tomato_sauce";
const RUN_ID = "run_sauce";
const FIX_ID = "run_sauce_fix";
const FIX_AGAIN_ID = "run_sauce_fix_again";
const CHIEF_ID = "user_kitchen_chief";
const OWNER_ID = "user_owner";
const SUPERVISOR_ID = "user_supervisor";
const SESSION_ID = "session_kitchen";
const DEVICE_ID = "device_kitchen";
const AUTHORIZATION_ID = "authorization_adjust_1";
const OCCURRED_AT = "2026-11-13T12:00:00.000Z";
const CORRECTED_AT = "2026-11-13T13:00:00.000Z";
const ADJUST = PERMISSION.INVENTORY_ADJUST;

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const balanceKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}:${locationId}:${ingredientId}`;

const runKey = (tenantId: string, runId: string): string =>
  `${tenantId}:${runId}`;

type Decision =
  | { outcome: "allowed"; selfAuthorized: false }
  | { outcome: "denied"; selfAuthorized: false };

const allowed: Decision = { outcome: "allowed", selfAuthorized: false };
const denied: Decision = { outcome: "denied", selfAuthorized: false };

class MemoryProduction extends ProductionRepository {
  readonly appended: AppendProductionCompensation[] = [];
  readonly edits: AppendProduction[] = [];
  private readonly balances = new Map<string, number>();
  private readonly averages = new Map<string, number>();
  private readonly runs = new Map<string, RecordedProductionRun>();
  private readonly compensations = new Map<
    string,
    AppendProductionCompensation
  >();

  rememberBalance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    quantity: number,
  ): void {
    this.balances.set(balanceKey(tenantId, locationId, ingredientId), quantity);
  }

  rememberAverage(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    averageCost: number,
  ): void {
    this.averages.set(
      balanceKey(tenantId, locationId, ingredientId),
      averageCost,
    );
  }

  rememberRun(run: RecordedProductionRun): void {
    this.runs.set(runKey(run.tenantId, run.runId), copyRun(run));
  }

  afterSales(): readonly never[] {
    return [];
  }

  override async findRun(
    tenantId: string,
    runId: string,
  ): Promise<RecordedProductionRun | null> {
    const found = this.runs.get(runKey(tenantId, runId));
    return found ? copyRun(found) : null;
  }

  override async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return (
      this.balances.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  override async averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return (
      this.averages.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  override async hasOpenAlert(): Promise<boolean> {
    return false;
  }

  override async policyFor(): Promise<null> {
    return null;
  }

  override async append(input: AppendProduction): Promise<void> {
    this.edits.push(input);
    throw new Error("A production run cannot be edited or deleted.");
  }

  override async findCompensation(
    tenantId: string,
    originalRunId: string,
  ): Promise<AppendProductionCompensation | null> {
    const found = this.compensations.get(runKey(tenantId, originalRunId));
    return found ? copyCompensation(found) : null;
  }

  override async appendCompensation(
    input: AppendProductionCompensation,
  ): Promise<void> {
    const key = runKey(input.tenantId, input.originalRunId);

    if (this.compensations.has(key)) {
      throw new ProductionAlreadyCompensated();
    }

    for (const movement of input.movements) {
      const stockKey = balanceKey(
        movement.tenantId,
        movement.locationId,
        movement.ingredientId,
      );
      const onHand = this.balances.get(stockKey) ?? 0;
      this.balances.set(stockKey, onHand + movement.quantity);
    }

    const stored = copyCompensation(input);
    this.compensations.set(key, stored);
    this.appended.push(stored);
  }
}

class ScriptedPermission extends EvaluatePermission {
  readonly inputs: Parameters<EvaluatePermission["execute"]>[0][] = [];

  constructor(private readonly decision: Decision) {
    super({} as never, {} as never, {} as never, {} as never);
  }

  override execute(
    input: Parameters<EvaluatePermission["execute"]>[0],
  ): Promise<Decision> {
    this.inputs.push(input);
    return Promise.resolve(this.decision);
  }
}

class ScriptedGrant extends ConsumeAuthorization {
  readonly calls: ConsumeAuthorizationInput[] = [];

  constructor(private readonly accepted: boolean) {
    super({} as never, {} as never);
  }

  override execute(input: ConsumeAuthorizationInput): Promise<boolean> {
    this.calls.push(input);
    return Promise.resolve(this.accepted);
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

const copyRun = (run: RecordedProductionRun): RecordedProductionRun => ({
  ...run,
  movements: run.movements.map((movement) => ({ ...movement })),
});

const copyCompensation = (
  input: AppendProductionCompensation,
): AppendProductionCompensation => ({
  ...input,
  movements: input.movements.map((movement) => ({ ...movement })),
});

const movement = (
  id: string,
  ingredientId: string,
  quantity: number,
  unitCost: number,
  type:
    | typeof MOVEMENT_TYPE.PRODUCTION_CONSUMPTION
    | typeof MOVEMENT_TYPE.PRODUCTION_OUTPUT,
) => ({
  id,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId,
  quantity,
  unitCost,
  type,
  reference: RUN_ID,
  occurredAt: OCCURRED_AT,
  actorId: CHIEF_ID,
  orderLineId: null,
  role: null,
  recipeVersion: 2,
});

const sauceRun = (actualQuantity: number): RecordedProductionRun => ({
  runId: RUN_ID,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  recipeId: SAUCE_ID,
  recipeVersion: 2,
  expectedQuantity: 5000,
  actualQuantity,
  variance: actualQuantity - 5000,
  outputUnitCost: actualQuantity === 0 ? null : 6,
  movements: [
    movement(
      `${RUN_ID}:consumption:0`,
      TOMATO_ID,
      grams(-6000),
      4,
      MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
    ),
    movement(
      `${RUN_ID}:consumption:1`,
      ONION_ID,
      grams(-500),
      6,
      MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
    ),
    ...(actualQuantity === 0
      ? []
      : [
          movement(
            `${RUN_ID}:output`,
            SAUCE_ID,
            grams(actualQuantity),
            6,
            MOVEMENT_TYPE.PRODUCTION_OUTPUT,
          ),
        ]),
  ],
});

const harness = (decision: Decision, accepted = false) => {
  const production = new MemoryProduction();
  const permissions = new ScriptedPermission(decision);
  const grants = new ScriptedGrant(accepted);
  const audits = new CapturedAudit();
  const correct = new CorrectProduction(
    production,
    permissions,
    grants,
    audits,
  );

  return { production, permissions, grants, audits, correct };
};

const command = (
  overrides: Partial<Parameters<CorrectProduction["execute"]>[0]> = {},
) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  originalRunId: RUN_ID,
  correctionRunId: FIX_ID,
  occurredAt: CORRECTED_AT,
  actorId: OWNER_ID,
  authorizerId: null as string | null,
  sessionId: SESSION_ID,
  deviceId: DEVICE_ID,
  authorizationId: null as string | null,
  ...overrides,
});

const seedStock = (
  production: MemoryProduction,
  sauceOnHand: number,
  sauceAverage: number,
): void => {
  production.rememberBalance(TENANT_ID, LOCATION_ID, TOMATO_ID, grams(4000));
  production.rememberAverage(TENANT_ID, LOCATION_ID, TOMATO_ID, 4);
  production.rememberBalance(TENANT_ID, LOCATION_ID, ONION_ID, grams(9500));
  production.rememberAverage(TENANT_ID, LOCATION_ID, ONION_ID, 6);
  production.rememberBalance(TENANT_ID, LOCATION_ID, SAUCE_ID, sauceOnHand);
  production.rememberAverage(TENANT_ID, LOCATION_ID, SAUCE_ID, sauceAverage);
};

const compensationLine = (
  id: string,
  ingredientId: string,
  quantity: number,
  unitCost: number,
  type:
    | typeof MOVEMENT_TYPE.PRODUCTION_CONSUMPTION
    | typeof MOVEMENT_TYPE.PRODUCTION_OUTPUT,
  reversesMovementId: string,
) => ({
  id,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId,
  quantity,
  unitCost,
  type,
  reference: FIX_ID,
  occurredAt: CORRECTED_AT,
  actorId: OWNER_ID,
  orderLineId: null,
  role: null,
  recipeVersion: 2,
  reversesMovementId,
});

it("given inventory.adjust, when a mistaken run is corrected, then opposite movements reference the originals and the originals stay", async () => {
  const { production, permissions, grants, audits, correct } = harness(allowed);
  const original = sauceRun(4600);
  production.rememberRun(original);
  seedStock(production, grams(4600), 4);

  const corrected = await correct.execute(command());

  expect(permissions.inputs).toEqual([
    {
      tenantId: TENANT_ID,
      sessionId: SESSION_ID,
      permission: ADJUST,
      target: { kind: "site", id: VENUE_ID, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    },
  ]);
  expect(grants.calls).toEqual([]);
  expect(production.edits).toEqual([]);
  expect(production.afterSales()).toEqual([]);
  expect(await production.findRun(TENANT_ID, RUN_ID)).toEqual(original);
  expect(corrected.movements).toEqual([
    compensationLine(
      `${FIX_ID}:consumption:0`,
      TOMATO_ID,
      grams(6000),
      4,
      MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      `${RUN_ID}:consumption:0`,
    ),
    compensationLine(
      `${FIX_ID}:consumption:1`,
      ONION_ID,
      grams(500),
      6,
      MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      `${RUN_ID}:consumption:1`,
    ),
    compensationLine(
      `${FIX_ID}:output`,
      SAUCE_ID,
      grams(-4600),
      6,
      MOVEMENT_TYPE.PRODUCTION_OUTPUT,
      `${RUN_ID}:output`,
    ),
  ]);
  expect(production.appended).toEqual([
    {
      tenantId: TENANT_ID,
      originalRunId: RUN_ID,
      correctionRunId: FIX_ID,
      movements: corrected.movements,
    },
  ]);
  expect(await production.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    grams(10000),
  );
  expect(await production.balance(TENANT_ID, LOCATION_ID, ONION_ID)).toBe(
    grams(10000),
  );
  expect(await production.balance(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(0);
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    4,
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, ONION_ID)).toBe(
    6,
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    4,
  );
  expect(audits.commands).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: OWNER_ID,
      authorizerId: null,
      deviceId: DEVICE_ID,
      siteId: VENUE_ID,
      action: ADJUST,
      entity: RUN_ID,
      before: {
        runId: RUN_ID,
        movements: original.movements.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      },
      after: {
        correctionRunId: FIX_ID,
        movements: corrected.movements.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          reversesMovementId: item.reversesMovementId,
        })),
      },
      reason: "production-compensation",
    },
  ]);
});

it("given a kitchen chief alone, when a run is corrected, then nothing changes", async () => {
  const { production, grants, audits, correct } = harness(denied);
  const original = sauceRun(4600);
  production.rememberRun(original);
  seedStock(production, grams(4600), 4);

  await expect(
    correct.execute(
      command({
        actorId: CHIEF_ID,
        authorizationId: null,
      }),
    ),
  ).rejects.toThrow(ProductionCorrectionDenied);
  expect(grants.calls).toEqual([]);
  expect(production.appended).toEqual([]);
  expect(production.edits).toEqual([]);
  expect(production.afterSales()).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(await production.findRun(TENANT_ID, RUN_ID)).toEqual(original);
  expect(await production.balance(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    grams(4600),
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    4,
  );
});

it("given a kitchen chief and a consumed authorization, when a run is corrected, then one compensation is stored", async () => {
  const { production, grants, audits, correct } = harness(denied, true);
  const original = sauceRun(4600);
  production.rememberRun(original);
  seedStock(production, grams(4600), 4);

  const corrected = await correct.execute(
    command({
      actorId: CHIEF_ID,
      authorizerId: SUPERVISOR_ID,
      authorizationId: AUTHORIZATION_ID,
    }),
  );

  expect(grants.calls).toEqual([
    {
      tenantId: TENANT_ID,
      authorizationId: AUTHORIZATION_ID,
      permission: ADJUST,
      targetId: VENUE_ID,
      value: null,
    },
  ]);
  expect(corrected.movements).toHaveLength(3);
  expect(corrected.movements[0]?.actorId).toBe(CHIEF_ID);
  expect(production.appended).toHaveLength(1);
  expect(production.edits).toEqual([]);
  expect(audits.commands[0]?.authorizerId).toBe(SUPERVISOR_ID);
  expect(audits.commands[0]?.actorId).toBe(CHIEF_ID);
  expect(await production.findRun(TENANT_ID, RUN_ID)).toEqual(original);
});

it("given a rejected authorization, when a run is corrected, then nothing changes", async () => {
  const { production, audits, correct } = harness(denied, false);
  const original = sauceRun(4600);
  production.rememberRun(original);
  seedStock(production, grams(4600), 4);

  await expect(
    correct.execute(
      command({
        actorId: CHIEF_ID,
        authorizerId: SUPERVISOR_ID,
        authorizationId: AUTHORIZATION_ID,
      }),
    ),
  ).rejects.toThrow(ProductionCorrectionDenied);
  expect(production.appended).toEqual([]);
  expect(production.edits).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(await production.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    grams(4000),
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    4,
  );
});

it("given a compensated run, when it is corrected again, then the second compensation is rejected", async () => {
  const { production, audits, correct } = harness(allowed);
  const original = sauceRun(4600);
  production.rememberRun(original);
  seedStock(production, grams(4600), 4);
  await correct.execute(command());

  await expect(
    correct.execute(command({ correctionRunId: FIX_AGAIN_ID })),
  ).rejects.toThrow(ProductionAlreadyCompensated);
  expect(production.appended).toHaveLength(1);
  expect(production.edits).toEqual([]);
  expect(audits.commands).toHaveLength(1);
  expect(await production.findRun(TENANT_ID, RUN_ID)).toEqual(original);
  expect(await production.balance(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(0);
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    4,
  );
});

it("given a burned batch, when it is compensated, then no output is written and the average cost stays", async () => {
  const { production, correct } = harness(allowed);
  const original = sauceRun(0);
  production.rememberRun(original);
  seedStock(production, grams(1000), 9);

  const corrected = await correct.execute(command({ correctionRunId: FIX_ID }));

  expect(original.outputUnitCost).toBeNull();
  expect(original.variance).toBe(-5000);
  expect(
    original.movements.some(
      (item) => item.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
    ),
  ).toBe(false);
  expect(
    corrected.movements.some(
      (item) => item.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
    ),
  ).toBe(false);
  expect(corrected.movements.map((item) => item.quantity)).toEqual([
    grams(6000),
    grams(500),
  ]);
  expect(corrected.movements.map((item) => item.reversesMovementId)).toEqual([
    `${RUN_ID}:consumption:0`,
    `${RUN_ID}:consumption:1`,
  ]);
  expect(production.edits).toEqual([]);
  expect(production.afterSales()).toEqual([]);
  expect(await production.findRun(TENANT_ID, RUN_ID)).toEqual(original);
  expect(await production.balance(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    grams(1000),
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, SAUCE_ID)).toBe(
    9,
  );
  expect(await production.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    4,
  );
  expect(await production.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    grams(10000),
  );
});

it("given another tenant, when an adjuster corrects the run, then nothing is stored", async () => {
  const { production, audits, correct } = harness(allowed);
  const original = sauceRun(4600);
  production.rememberRun(original);
  seedStock(production, grams(4600), 4);

  await expect(
    correct.execute(command({ tenantId: OTHER_TENANT_ID })),
  ).rejects.toThrow(UnknownProductionRun);
  expect(production.appended).toEqual([]);
  expect(production.edits).toEqual([]);
  expect(audits.commands).toEqual([]);
  expect(await production.findRun(TENANT_ID, RUN_ID)).toEqual(original);
});
