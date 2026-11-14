import { expect, it } from "vitest";

import {
  InvalidProduction,
  PRODUCTION_COST_RULE,
  ProductionAlreadyCompensated,
  ProductionRun,
} from "#domain/production.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const ONION_ID = "ingredient_onion";
const SAUCE_ID = "recipe_tomato_sauce";
const RUN_ID = "run_sauce";

const sauceRun = (actualQuantity: number) =>
  ProductionRun.record({
    runId: RUN_ID,
    locationId: LOCATION_ID,
    recipeId: SAUCE_ID,
    outputQuantity: 5000,
    expectedQuantity: 5000,
    actualQuantity,
    lines: [
      { ingredientId: TOMATO_ID, quantity: 6000, unitCost: 0 },
      { ingredientId: ONION_ID, quantity: 500, unitCost: 0 },
    ],
    costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
  });

it("given a line of 100 for an output of 3, when the expected batch is 2, then consumption is floor(line * expected / outputQuantity)", () => {
  const run = ProductionRun.record({
    runId: "run_floor",
    locationId: LOCATION_ID,
    recipeId: SAUCE_ID,
    outputQuantity: 3,
    expectedQuantity: 2,
    actualQuantity: 2,
    lines: [{ ingredientId: TOMATO_ID, quantity: 100, unitCost: 0 }],
    costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
  });

  expect(run.variance).toBe(0);
  expect(run.movements).toEqual([
    {
      id: "run_floor:consumption:0",
      locationId: LOCATION_ID,
      ingredientId: TOMATO_ID,
      quantity: -66,
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      reference: "run_floor",
    },
    {
      id: "run_floor:output",
      locationId: LOCATION_ID,
      ingredientId: SAUCE_ID,
      quantity: 2,
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_OUTPUT,
      reference: "run_floor",
    },
  ]);
});

it("given a batch expected at 5000 g, when actual output is 4600 g, then variance is actual minus expected", () => {
  const run = sauceRun(4600);
  const output = run.movements.find(
    (movement) => movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
  );

  expect(run.expectedQuantity).toBe(5000);
  expect(run.actualQuantity).toBe(4600);
  expect(run.variance).toBe(-400);
  expect(run.movements).toEqual([
    {
      id: `${RUN_ID}:consumption:0`,
      locationId: LOCATION_ID,
      ingredientId: TOMATO_ID,
      quantity: -6000,
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      reference: RUN_ID,
    },
    {
      id: `${RUN_ID}:consumption:1`,
      locationId: LOCATION_ID,
      ingredientId: ONION_ID,
      quantity: -500,
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      reference: RUN_ID,
    },
    {
      id: `${RUN_ID}:output`,
      locationId: LOCATION_ID,
      ingredientId: SAUCE_ID,
      quantity: 4600,
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_OUTPUT,
      reference: RUN_ID,
    },
  ]);
  expect(output?.quantity).toBe(4600);
});

it("given actual output 0, when the batch is recorded, then ingredients are consumed and no output is written", () => {
  const run = sauceRun(0);

  expect(run.variance).toBe(-5000);
  expect(run.outputUnitCost).toBeNull();
  expect(run.movements).toEqual([
    {
      id: `${RUN_ID}:consumption:0`,
      locationId: LOCATION_ID,
      ingredientId: TOMATO_ID,
      quantity: -6000,
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      reference: RUN_ID,
    },
    {
      id: `${RUN_ID}:consumption:1`,
      locationId: LOCATION_ID,
      ingredientId: ONION_ID,
      quantity: -500,
      unitCost: 0,
      type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      reference: RUN_ID,
    },
  ]);
  expect(
    run.movements.some(
      (movement) => movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
    ),
  ).toBe(false);
});

it("given consumed inputs cost 24000 COP, when actual output is 4000 g under consumed average, then output cost is 6", () => {
  const run = ProductionRun.record({
    runId: "run_average",
    locationId: LOCATION_ID,
    recipeId: SAUCE_ID,
    outputQuantity: 4000,
    expectedQuantity: 4000,
    actualQuantity: 4000,
    lines: [
      { ingredientId: TOMATO_ID, quantity: 3000, unitCost: 4 },
      { ingredientId: ONION_ID, quantity: 2000, unitCost: 6 },
    ],
    costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
  });
  const output = run.movements.find(
    (movement) => movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
  );

  expect(run.outputUnitCost).toBe(6);
  expect(output?.unitCost).toBe(6);
  expect(output?.ingredientId).toBe(SAUCE_ID);
  expect(output?.quantity).toBe(4000);
});

it("given a standard cost of 5 COP/g, when actual output is 4000 g, then output cost is 5", () => {
  const run = ProductionRun.record({
    runId: "run_standard",
    locationId: LOCATION_ID,
    recipeId: SAUCE_ID,
    outputQuantity: 4000,
    expectedQuantity: 4000,
    actualQuantity: 4000,
    lines: [
      { ingredientId: TOMATO_ID, quantity: 3000, unitCost: 4 },
      { ingredientId: ONION_ID, quantity: 2000, unitCost: 6 },
    ],
    costRule: PRODUCTION_COST_RULE.STANDARD,
    standardUnitCost: 5,
  });
  const tomato = run.movements.find(
    (movement) => movement.ingredientId === TOMATO_ID,
  );
  const output = run.movements.find(
    (movement) => movement.type === MOVEMENT_TYPE.PRODUCTION_OUTPUT,
  );

  expect(run.outputUnitCost).toBe(5);
  expect(output?.unitCost).toBe(5);
  expect(tomato?.unitCost).toBe(4);
  expect(tomato?.quantity).toBe(-3000);
});

it("given consumed cost does not divide evenly, when output is valued at consumed average, then the unit cost rounds half up", () => {
  const run = ProductionRun.record({
    runId: "run_half_up",
    locationId: LOCATION_ID,
    recipeId: SAUCE_ID,
    outputQuantity: 1,
    expectedQuantity: 1,
    actualQuantity: 2,
    lines: [{ ingredientId: TOMATO_ID, quantity: 1, unitCost: 5 }],
    costRule: PRODUCTION_COST_RULE.CONSUMED_AVERAGE,
  });

  expect(run.outputUnitCost).toBe(3);
});

it("given a recorded run, when it is compensated twice, then only the first compensation is stored", () => {
  const run = sauceRun(4600);
  const before = run.movements.map((movement) => ({ ...movement }));

  const compensated = run.compensate({ runId: "run_sauce_fix" });

  expect(compensated.map((movement) => movement.quantity)).toEqual(
    before.map((movement) => -movement.quantity),
  );
  expect(compensated.map((movement) => movement.type)).toEqual(
    before.map((movement) => movement.type),
  );
  expect(compensated.map((movement) => movement.reversesMovementId)).toEqual(
    before.map((movement) => movement.id),
  );
  expect(compensated.map((movement) => movement.reference)).toEqual(
    before.map(() => "run_sauce_fix"),
  );
  expect(compensated.map((movement) => movement.id)).toEqual([
    "run_sauce_fix:consumption:0",
    "run_sauce_fix:consumption:1",
    "run_sauce_fix:output",
  ]);
  expect(run.movements.slice(0, before.length)).toEqual(before);

  let caught: unknown;
  const again = () => {
    run.compensate({ runId: "run_sauce_fix_2" });
  };

  try {
    again();
  } catch (error) {
    caught = error;
  }

  expect(again).toThrow(ProductionAlreadyCompensated);
  expect(caught).toBeInstanceOf(ProductionAlreadyCompensated);
  expect(run.movements).toHaveLength(before.length * 2);
});

it("given a standard rule without a standard unit cost, when a run is recorded, then it is rejected", () => {
  const record = () => {
    ProductionRun.record({
      runId: "run_missing_standard",
      locationId: LOCATION_ID,
      recipeId: SAUCE_ID,
      outputQuantity: 4000,
      expectedQuantity: 4000,
      actualQuantity: 4000,
      lines: [{ ingredientId: TOMATO_ID, quantity: 4000, unitCost: 4 }],
      costRule: PRODUCTION_COST_RULE.STANDARD,
    });
  };

  expect(record).toThrow(InvalidProduction);
});
