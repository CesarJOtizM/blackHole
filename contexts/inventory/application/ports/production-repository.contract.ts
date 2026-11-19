import { expect, it } from "vitest";
import type {
  AppendProductionCompensation,
  ProductionCompensationLine,
  ProductionRepository,
  ProductionStockLine,
  RecordedProductionRun,
} from "#application/ports/production-repository.js";
import { PRODUCTION_COST_RULE } from "#domain/production.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "venue_site";
const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const ONION_ID = "ingredient_onion";
const SAUCE_ID = "recipe_tomato_sauce";
const ACTOR_ID = "user_kitchen_chief";
const OCCURRED_AT = "2026-11-13T12:00:00.000Z";
const RECIPE_VERSION = 2;
const RUN_ID = "run_sauce";

export interface StoredProductionMovement extends ProductionStockLine {
  reversesMovementId?: string;
}

export interface ProductionContractSubject {
  production: ProductionRepository;
  movements(tenantId: string): Promise<readonly StoredProductionMovement[]>;
  outboxCount(tenantId: string): Promise<number>;
  failOnInsert(ordinal: number): void;
  seedHolding(input: {
    tenantId: string;
    locationId: string;
    ingredientId: string;
    quantity: number;
    averageCost: number;
  }): Promise<void>;
}

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const movement = (
  id: string,
  ingredientId: string,
  quantity: number,
  unitCost: number,
  type: ProductionStockLine["type"],
  reference: string,
  reversesMovementId?: string,
): StoredProductionMovement => ({
  id,
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  ingredientId,
  quantity,
  unitCost,
  type,
  reference,
  occurredAt: OCCURRED_AT,
  actorId: ACTOR_ID,
  orderLineId: null,
  role: null,
  recipeVersion: RECIPE_VERSION,
  ...(reversesMovementId === undefined ? {} : { reversesMovementId }),
});

const sauceMovements = (): StoredProductionMovement[] => [
  movement(
    `${RUN_ID}:consumption:0`,
    TOMATO_ID,
    grams(-6000),
    4,
    MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
    RUN_ID,
  ),
  movement(
    `${RUN_ID}:consumption:1`,
    ONION_ID,
    grams(-500),
    5,
    MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
    RUN_ID,
  ),
  movement(
    `${RUN_ID}:output`,
    SAUCE_ID,
    grams(4600),
    6,
    MOVEMENT_TYPE.PRODUCTION_OUTPUT,
    RUN_ID,
  ),
];

const sauceRun = (): RecordedProductionRun => ({
  runId: RUN_ID,
  tenantId: TENANT_A,
  venueId: VENUE_ID,
  locationId: LOCATION_ID,
  recipeId: SAUCE_ID,
  recipeVersion: RECIPE_VERSION,
  expectedQuantity: 5000,
  actualQuantity: 4600,
  variance: -400,
  outputUnitCost: 6,
  movements: sauceMovements(),
});

const seedPantry = async (
  subject: ProductionContractSubject,
): Promise<void> => {
  await subject.seedHolding({
    tenantId: TENANT_A,
    locationId: LOCATION_ID,
    ingredientId: TOMATO_ID,
    quantity: grams(10000),
    averageCost: 4,
  });
  await subject.seedHolding({
    tenantId: TENANT_A,
    locationId: LOCATION_ID,
    ingredientId: ONION_ID,
    quantity: grams(1000),
    averageCost: 5,
  });
  await subject.seedHolding({
    tenantId: TENANT_A,
    locationId: LOCATION_ID,
    ingredientId: SAUCE_ID,
    quantity: grams(4600),
    averageCost: 0,
  });
};

const compensationLine = (
  id: string,
  ingredientId: string,
  quantity: number,
  unitCost: number,
  type: ProductionStockLine["type"],
  reference: string,
  reversesMovementId: string,
): ProductionCompensationLine => ({
  ...movement(id, ingredientId, quantity, unitCost, type, reference),
  reversesMovementId,
});

const compensation = (): AppendProductionCompensation => ({
  tenantId: TENANT_A,
  originalRunId: RUN_ID,
  correctionRunId: "run_sauce_correction",
  movements: [
    compensationLine(
      "run_sauce_correction:consumption:0",
      TOMATO_ID,
      grams(6000),
      4,
      MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      "run_sauce_correction",
      `${RUN_ID}:consumption:0`,
    ),
    compensationLine(
      "run_sauce_correction:consumption:1",
      ONION_ID,
      grams(500),
      5,
      MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      "run_sauce_correction",
      `${RUN_ID}:consumption:1`,
    ),
    compensationLine(
      "run_sauce_correction:output",
      SAUCE_ID,
      grams(-4600),
      6,
      MOVEMENT_TYPE.PRODUCTION_OUTPUT,
      "run_sauce_correction",
      `${RUN_ID}:output`,
    ),
  ],
});

export function productionRepositoryContract(
  open: () => ProductionContractSubject | Promise<ProductionContractSubject>,
): void {
  it("given sauce stock at cost 0 and inputs on hand, when the run is appended twice, then balances match once and nothing is queued after sales", async () => {
    const subject = await open();
    await seedPantry(subject);
    const run = sauceRun();

    await subject.production.append({ run, alerts: [] });
    await subject.production.append({
      run: {
        ...run,
        actualQuantity: 1,
        variance: -4999,
        movements: [
          movement(
            "run_ignored:consumption:0",
            TOMATO_ID,
            grams(-9000),
            4,
            MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
            RUN_ID,
          ),
        ],
      },
      alerts: [],
    });

    // 4600 g at 0 plus 4600 g at 6, half-up, is 3.
    expect(
      await subject.production.balance(TENANT_A, LOCATION_ID, TOMATO_ID),
    ).toBe(grams(4000));
    expect(
      await subject.production.averageCost(TENANT_A, LOCATION_ID, TOMATO_ID),
    ).toBe(4);
    expect(
      await subject.production.balance(TENANT_A, LOCATION_ID, ONION_ID),
    ).toBe(grams(500));
    expect(
      await subject.production.averageCost(TENANT_A, LOCATION_ID, ONION_ID),
    ).toBe(5);
    expect(
      await subject.production.balance(TENANT_A, LOCATION_ID, SAUCE_ID),
    ).toBe(grams(9200));
    expect(
      await subject.production.averageCost(TENANT_A, LOCATION_ID, SAUCE_ID),
    ).toBe(3);
    expect(await subject.production.findRun(TENANT_A, RUN_ID)).toEqual(run);
    expect(await subject.movements(TENANT_A)).toEqual(sauceMovements());
    expect(await subject.outboxCount(TENANT_A)).toBe(0);
  });

  it("given a run stored for tenant A, when tenant B reads, then tenant A stays hidden", async () => {
    const subject = await open();
    await seedPantry(subject);
    await subject.production.append({ run: sauceRun(), alerts: [] });

    expect(await subject.production.findRun(TENANT_B, RUN_ID)).toBeNull();
    expect(await subject.movements(TENANT_B)).toEqual([]);
    expect(
      await subject.production.balance(TENANT_B, LOCATION_ID, SAUCE_ID),
    ).toBe(0);
    expect(
      await subject.production.averageCost(TENANT_B, LOCATION_ID, SAUCE_ID),
    ).toBe(0);
    expect(
      await subject.production.hasOpenAlert(TENANT_B, LOCATION_ID, TOMATO_ID),
    ).toBe(false);
    expect(await subject.production.policyFor(TENANT_B, SAUCE_ID)).toBeNull();
    expect(await subject.production.findRun(TENANT_A, RUN_ID)).toEqual(
      sauceRun(),
    );
    expect(
      await subject.production.balance(TENANT_A, LOCATION_ID, TOMATO_ID),
    ).toBe(grams(4000));
  });

  it("given a stored run, when the output insert fails, then the consumption, balance, and alert roll back", async () => {
    const subject = await open();
    await seedPantry(subject);
    await subject.production.append({ run: sauceRun(), alerts: [] });
    const balance = await subject.production.balance(
      TENANT_A,
      LOCATION_ID,
      TOMATO_ID,
    );
    const average = await subject.production.averageCost(
      TENANT_A,
      LOCATION_ID,
      SAUCE_ID,
    );
    const stored = await subject.movements(TENANT_A);
    const failedId = "run_failed";

    expect(balance).toBe(grams(4000));
    subject.failOnInsert(3);

    await expect(
      subject.production.append({
        run: {
          ...sauceRun(),
          runId: failedId,
          movements: [
            movement(
              `${failedId}:consumption:0`,
              TOMATO_ID,
              grams(-1000),
              4,
              MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
              failedId,
            ),
            movement(
              `${failedId}:consumption:1`,
              ONION_ID,
              grams(-100),
              5,
              MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
              failedId,
            ),
            movement(
              `${failedId}:output`,
              SAUCE_ID,
              grams(100),
              6,
              MOVEMENT_TYPE.PRODUCTION_OUTPUT,
              failedId,
            ),
          ],
        },
        alerts: [
          {
            type: "NegativeStockOpened",
            tenantId: TENANT_A,
            venueId: VENUE_ID,
            locationId: LOCATION_ID,
            ingredientId: TOMATO_ID,
            balance: grams(-1),
            occurredAt: OCCURRED_AT,
          },
        ],
      }),
    ).rejects.toThrow();

    expect(await subject.production.findRun(TENANT_A, failedId)).toBeNull();
    expect(await subject.production.findRun(TENANT_A, RUN_ID)).toEqual(
      sauceRun(),
    );
    expect(
      await subject.production.balance(TENANT_A, LOCATION_ID, TOMATO_ID),
    ).toBe(balance);
    expect(
      await subject.production.averageCost(TENANT_A, LOCATION_ID, SAUCE_ID),
    ).toBe(average);
    expect(await subject.movements(TENANT_A)).toEqual(stored);
    expect(
      await subject.production.hasOpenAlert(TENANT_A, LOCATION_ID, TOMATO_ID),
    ).toBe(false);
    expect(await subject.outboxCount(TENANT_A)).toBe(0);
  });

  it("given a stored run, when it is compensated and a standard cost is saved, then the opposite movements post once and the other tenant stays hidden", async () => {
    const subject = await open();
    await seedPantry(subject);
    await subject.production.append({ run: sauceRun(), alerts: [] });
    const correcting = compensation();

    await subject.production.appendCompensation(correcting);
    await subject.production.saveCostPolicy({
      tenantId: TENANT_A,
      costRule: PRODUCTION_COST_RULE.STANDARD,
      preparations: [{ recipeId: SAUCE_ID, standardUnitCost: 5 }],
    });

    expect(await subject.production.findCompensation(TENANT_A, RUN_ID)).toEqual(
      correcting,
    );
    expect(await subject.production.findRun(TENANT_A, RUN_ID)).toEqual(
      sauceRun(),
    );
    expect(
      await subject.production.balance(TENANT_A, LOCATION_ID, TOMATO_ID),
    ).toBe(grams(10000));
    expect(
      await subject.production.averageCost(TENANT_A, LOCATION_ID, TOMATO_ID),
    ).toBe(4);
    expect(
      await subject.production.balance(TENANT_A, LOCATION_ID, SAUCE_ID),
    ).toBe(grams(4600));
    expect(
      await subject.production.averageCost(TENANT_A, LOCATION_ID, SAUCE_ID),
    ).toBe(3);
    expect(await subject.movements(TENANT_A)).toEqual([
      ...sauceMovements(),
      ...correcting.movements,
    ]);
    expect(await subject.production.policyFor(TENANT_A, SAUCE_ID)).toEqual({
      costRule: PRODUCTION_COST_RULE.STANDARD,
      standardUnitCost: 5,
    });
    expect(
      await subject.production.policyFor(TENANT_A, "recipe_other"),
    ).toEqual({
      costRule: PRODUCTION_COST_RULE.STANDARD,
      standardUnitCost: null,
    });
    expect(
      await subject.production.findCompensation(TENANT_B, RUN_ID),
    ).toBeNull();
    expect(await subject.production.policyFor(TENANT_B, SAUCE_ID)).toBeNull();
    expect(
      await subject.production.balance(TENANT_B, LOCATION_ID, SAUCE_ID),
    ).toBe(0);
    expect(await subject.outboxCount(TENANT_A)).toBe(0);
  });
}
