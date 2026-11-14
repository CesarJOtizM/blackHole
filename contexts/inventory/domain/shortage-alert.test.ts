import { expect, it } from "vitest";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  defineStockLevels,
  ESCALATION_CLOCK,
  escalationClock,
  evaluateLevel,
  InvalidStockLevels,
  LEVEL_ACTION,
  LEVEL_SEVERITY,
  roundUpRestock,
  SHORTAGE_KIND,
  soldOut,
} from "#domain/shortage-alert.js";

const kilograms = (quantity: number): number => quantity * QUANTITY_SCALE;

const beefLevels = () =>
  defineStockLevels({
    maximum: kilograms(20),
    reorderPoint: kilograms(15),
    minimum: kilograms(8),
  });

it("given a minimum of 8 kg, when the reorder point is set to 5 kg, then the levels are rejected", () => {
  const setLevels = () => {
    defineStockLevels({
      maximum: kilograms(20),
      reorderPoint: kilograms(5),
      minimum: kilograms(8),
    });
  };

  expect(setLevels).toThrow(InvalidStockLevels);
});

it("given a maximum below the reorder point, when levels are set, then they are rejected", () => {
  const setLevels = () => {
    defineStockLevels({
      maximum: kilograms(10),
      reorderPoint: kilograms(15),
      minimum: kilograms(8),
    });
  };

  expect(setLevels).toThrow(InvalidStockLevels);
});

it("given a negative minimum, when levels are set, then they are rejected", () => {
  const setLevels = () => {
    defineStockLevels({
      maximum: kilograms(20),
      reorderPoint: kilograms(15),
      minimum: -kilograms(1),
    });
  };

  expect(setLevels).toThrow(InvalidStockLevels);
});

it("given a fractional scaled quantity, when levels are set, then they are rejected", () => {
  const setLevels = () => {
    defineStockLevels({
      maximum: kilograms(20) + 0.5,
      reorderPoint: kilograms(15),
      minimum: kilograms(8),
    });
  };

  expect(setLevels).toThrow(InvalidStockLevels);
});

it("given maximum, reorder point, and minimum in order, when levels are set, then they are kept", () => {
  const levels = defineStockLevels({
    maximum: kilograms(20),
    reorderPoint: kilograms(15),
    minimum: kilograms(8),
  });

  expect(levels).toEqual({
    maximum: kilograms(20),
    reorderPoint: kilograms(15),
    minimum: kilograms(8),
  });
});

it("given equal maximum, reorder point, and minimum, when levels are set, then they are kept", () => {
  const levels = defineStockLevels({
    maximum: kilograms(10),
    reorderPoint: kilograms(10),
    minimum: kilograms(10),
  });

  expect(levels).toEqual({
    maximum: kilograms(10),
    reorderPoint: kilograms(10),
    minimum: kilograms(10),
  });
});

it("given beef at 16 kg with a reorder point of 15 kg, when a sale leaves 14 kg, then one yellow alert opens", () => {
  const decision = evaluateLevel({
    onHand: kilograms(14),
    levels: beefLevels(),
  });

  expect(decision).toEqual({
    action: LEVEL_ACTION.OPEN,
    severity: LEVEL_SEVERITY.YELLOW,
    soldOut: false,
  });
});

it("given stock exactly at the reorder point, when it is evaluated, then the alert is yellow", () => {
  const decision = evaluateLevel({
    onHand: kilograms(15),
    levels: beefLevels(),
  });

  expect(decision).toEqual({
    action: LEVEL_ACTION.OPEN,
    severity: LEVEL_SEVERITY.YELLOW,
    soldOut: false,
  });
});

it("given stock above the reorder point, when it is evaluated, then no alert opens", () => {
  const decision = evaluateLevel({
    onHand: kilograms(16),
    levels: beefLevels(),
  });

  expect(decision).toEqual({ action: LEVEL_ACTION.NONE });
});

it("given stock exactly at the minimum, when it is evaluated, then one red alert opens", () => {
  const decision = evaluateLevel({
    onHand: kilograms(8),
    levels: beefLevels(),
  });

  expect(decision).toEqual({
    action: LEVEL_ACTION.OPEN,
    severity: LEVEL_SEVERITY.RED,
    soldOut: false,
  });
});

it("given stock at zero, when it is evaluated, then one critical alert opens and it is sold out", () => {
  const decision = evaluateLevel({
    onHand: 0,
    levels: beefLevels(),
  });

  expect(soldOut(0)).toBe(true);
  expect(decision).toEqual({
    action: LEVEL_ACTION.OPEN,
    severity: LEVEL_SEVERITY.CRITICAL,
    soldOut: true,
  });
});

it("given stock below zero, when it is evaluated, then it is critical and sold out", () => {
  const onHand = -kilograms(1);
  const decision = evaluateLevel({
    onHand,
    levels: beefLevels(),
  });

  expect(soldOut(onHand)).toBe(true);
  expect(soldOut(1)).toBe(false);
  expect(decision).toEqual({
    action: LEVEL_ACTION.OPEN,
    severity: LEVEL_SEVERITY.CRITICAL,
    soldOut: true,
  });
});

it("given beef at 3 kg, when a 4 kg waste leaves stock at or under zero, then one critical alert opens", () => {
  const decision = evaluateLevel({
    onHand: kilograms(3) - kilograms(4),
    levels: beefLevels(),
  });

  expect(Array.isArray(decision)).toBe(false);
  expect(decision).toEqual({
    action: LEVEL_ACTION.OPEN,
    severity: LEVEL_SEVERITY.CRITICAL,
    soldOut: true,
  });
  expect(Object.keys(decision).toSorted()).toEqual([
    "action",
    "severity",
    "soldOut",
  ]);
});

it("given an open red alert, when stock rises just above the minimum, then the same state is not emitted again", () => {
  const decision = evaluateLevel({
    onHand: kilograms(8) + 1,
    levels: beefLevels(),
    openSeverity: LEVEL_SEVERITY.RED,
  });

  expect(decision).toEqual({ action: LEVEL_ACTION.HOLD });
});

it("given an open yellow alert, when stock stays at or under the reorder point, then yellow is not emitted again", () => {
  const decision = evaluateLevel({
    onHand: kilograms(14),
    levels: beefLevels(),
    openSeverity: LEVEL_SEVERITY.YELLOW,
  });

  expect(decision).toEqual({ action: LEVEL_ACTION.HOLD });
});

it("given an open critical alert, when stock stays at or under zero, then critical is not emitted again", () => {
  const decision = evaluateLevel({
    onHand: 0,
    levels: beefLevels(),
    openSeverity: LEVEL_SEVERITY.CRITICAL,
  });

  expect(decision).toEqual({ action: LEVEL_ACTION.HOLD });
});

it("given an open yellow alert, when stock falls to zero, then that alert is raised to one critical", () => {
  const decision = evaluateLevel({
    onHand: 0,
    levels: beefLevels(),
    openSeverity: LEVEL_SEVERITY.YELLOW,
  });

  expect(decision).toEqual({
    action: LEVEL_ACTION.RAISE,
    severity: LEVEL_SEVERITY.CRITICAL,
    soldOut: true,
  });
});

it("given an open yellow alert, when stock is exactly at the reorder point, then it stays open", () => {
  const decision = evaluateLevel({
    onHand: kilograms(15),
    levels: beefLevels(),
    openSeverity: LEVEL_SEVERITY.YELLOW,
  });

  expect(decision).toEqual({ action: LEVEL_ACTION.HOLD });
});

it("given an open red alert, when stock rises above the reorder point, then it resolves", () => {
  const decision = evaluateLevel({
    onHand: kilograms(16),
    levels: beefLevels(),
    openSeverity: LEVEL_SEVERITY.RED,
  });

  expect(decision).toEqual({ action: LEVEL_ACTION.RESOLVE });
});

it("given beef at 4 kg, a maximum of 20 kg, and a 1 kg purchase unit, when restock is calculated, then it is 16 kg", () => {
  const quantity = roundUpRestock({
    maximum: kilograms(20),
    onHand: kilograms(4),
    purchaseUnit: kilograms(1),
  });

  expect(quantity).toBe(kilograms(16));
});

it("given a 15 kg shortfall and a 2 kg purchase unit, when restock is calculated, then it rounds up to 16 kg", () => {
  const quantity = roundUpRestock({
    maximum: kilograms(20),
    onHand: kilograms(5),
    purchaseUnit: kilograms(2),
  });

  expect(quantity).toBe(kilograms(16));
});

it("given stock below zero and a 1 kg purchase unit, when restock is calculated, then the shortfall rounds up", () => {
  const quantity = roundUpRestock({
    maximum: kilograms(20),
    onHand: -kilograms(1),
    purchaseUnit: kilograms(1),
  });

  expect(quantity).toBe(kilograms(21));
});

it("given a critical level alert, when the escalation clock is read, then it is the red clock", () => {
  const critical = escalationClock(
    SHORTAGE_KIND.LEVEL,
    LEVEL_SEVERITY.CRITICAL,
  );
  const red = escalationClock(SHORTAGE_KIND.LEVEL, LEVEL_SEVERITY.RED);

  expect(Object.values(ESCALATION_CLOCK)).toEqual([ESCALATION_CLOCK.RED]);
  expect(critical).toBe(ESCALATION_CLOCK.RED);
  expect(red).toBe(ESCALATION_CLOCK.RED);
  expect(critical).toBe(red);
});

it("given yellow, coverage, or a dish, when the escalation clock is read, then there is no clock", () => {
  expect(
    escalationClock(SHORTAGE_KIND.LEVEL, LEVEL_SEVERITY.YELLOW),
  ).toBeUndefined();
  expect(escalationClock(SHORTAGE_KIND.COVERAGE)).toBeUndefined();
  expect(escalationClock(SHORTAGE_KIND.DISH)).toBeUndefined();
});
