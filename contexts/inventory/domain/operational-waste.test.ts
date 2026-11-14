import { expect, it } from "vitest";
import {
  InvalidWaste,
  MissingWasteReason,
  recordOperationalWaste,
  WASTE_REASON,
  WasteNoteRequired,
} from "#domain/operational-waste.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

const LOCATION_ID = "location_point_of_sale";
const MILK_ID = "ingredient_milk";

const millilitres = (quantity: number): number => quantity * QUANTITY_SCALE;

const waste = (input: {
  quantity: number;
  averageCost: number;
  reason?: string;
  note?: string;
}) =>
  recordOperationalWaste({
    locationId: LOCATION_ID,
    ingredientId: MILK_ID,
    ...input,
  });

it("given milk at 4 COP/ml, when 1000 ml is recorded as expired, then the quantity is negative, the value is 4000 whole COP, the average stays 4, and there is no reversal id", () => {
  const recorded = waste({
    quantity: -millilitres(1000),
    averageCost: 4,
    reason: WASTE_REASON.EXPIRED,
  });
  const recomputed = nextAverageCost({
    onHand: millilitres(1000),
    averageCost: 4,
    receivedQuantity: millilitres(1000),
    receiptCost: 10,
  });

  expect(recorded.quantity).toBe(-millilitres(1000));
  expect(recorded.valueCop).toBe(4000);
  expect(recorded.averageCost).toBe(4);
  expect(recorded.averageCost).not.toBe(recomputed);
  expect(recorded.reason).toBe(WASTE_REASON.EXPIRED);
  expect(recorded.type).toBe(MOVEMENT_TYPE.WASTE);
  expect(recorded.locationId).toBe(LOCATION_ID);
  expect(recorded.ingredientId).toBe(MILK_ID);
  expect("reversesMovementId" in recorded).toBe(false);
});

it("given damaged and preparation error, when each is recorded, then both keep a negative quantity and no reversal id", () => {
  const damaged = waste({
    quantity: -millilitres(200),
    averageCost: 4,
    reason: WASTE_REASON.DAMAGED,
  });
  const preparationError = waste({
    quantity: -millilitres(50),
    averageCost: 4,
    reason: WASTE_REASON.PREPARATION_ERROR,
  });

  expect(damaged.reason).toBe(WASTE_REASON.DAMAGED);
  expect(damaged.quantity).toBe(-millilitres(200));
  expect(damaged.valueCop).toBe(800);
  expect("reversesMovementId" in damaged).toBe(false);
  expect(preparationError.reason).toBe(WASTE_REASON.PREPARATION_ERROR);
  expect(preparationError.quantity).toBe(-millilitres(50));
  expect(preparationError.valueCop).toBe(200);
  expect("reversesMovementId" in preparationError).toBe(false);
});

it("given reason other and a note, when it is recorded, then the note is kept and the average stays", () => {
  const recorded = waste({
    quantity: -millilitres(10),
    averageCost: 6,
    reason: WASTE_REASON.OTHER,
    note: "Spilled while plating",
  });

  expect(recorded.reason).toBe(WASTE_REASON.OTHER);
  expect(recorded.note).toBe("Spilled while plating");
  expect(recorded.quantity).toBe(-millilitres(10));
  expect(recorded.valueCop).toBe(60);
  expect(recorded.averageCost).toBe(6);
  expect("reversesMovementId" in recorded).toBe(false);
});

it("given reason other without a note, when it is submitted, then it is rejected", () => {
  const missing = () => {
    waste({
      quantity: -millilitres(10),
      averageCost: 6,
      reason: WASTE_REASON.OTHER,
    });
  };
  const blank = () => {
    waste({
      quantity: -millilitres(10),
      averageCost: 6,
      reason: WASTE_REASON.OTHER,
      note: "   ",
    });
  };

  expect(missing).toThrow(WasteNoteRequired);
  expect(blank).toThrow(WasteNoteRequired);
});

it("given a waste entry without a reason, when it is submitted, then it is rejected", () => {
  const omitted = () => {
    waste({
      quantity: -millilitres(10),
      averageCost: 4,
    });
  };
  const unknown = () => {
    waste({
      quantity: -millilitres(10),
      averageCost: 4,
      reason: "theft",
    });
  };

  expect(omitted).toThrow(MissingWasteReason);
  expect(unknown).toThrow(MissingWasteReason);
});

it("given a quantity that is not a negative whole number of base units, when it is recorded, then it is rejected", () => {
  const positive = () => {
    waste({
      quantity: millilitres(10),
      averageCost: 4,
      reason: WASTE_REASON.EXPIRED,
    });
  };
  const zero = () => {
    waste({
      quantity: 0,
      averageCost: 4,
      reason: WASTE_REASON.EXPIRED,
    });
  };
  const fraction = () => {
    waste({
      quantity: -1.5,
      averageCost: 4,
      reason: WASTE_REASON.EXPIRED,
    });
  };

  expect(positive).toThrow(InvalidWaste);
  expect(zero).toThrow(InvalidWaste);
  expect(fraction).toThrow(InvalidWaste);
});

it("given a value that is not a whole number of COP, when it is recorded, then it is rejected and the average is not changed", () => {
  const fractionalValue = () => {
    waste({
      quantity: -500,
      averageCost: 1,
      reason: WASTE_REASON.DAMAGED,
    });
  };
  const fractionalCost = () => {
    waste({
      quantity: -millilitres(10),
      averageCost: 1.5,
      reason: WASTE_REASON.DAMAGED,
    });
  };

  expect(fractionalValue).toThrow(InvalidWaste);
  expect(fractionalCost).toThrow(InvalidWaste);
});
