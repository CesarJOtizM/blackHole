import { expect, it } from "vitest";

import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  MOVEMENT_TYPE,
  MovementAlreadyReversed,
  MovementImmutable,
  MovementTypeNotWritable,
  StockLedger,
} from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const LOCATION_ID = "location_point_of_sale";
const BEEF_ID = "ingredient_beef";
const MOVEMENT_ID = "movement_beef_consumption";
const REVERSAL_ID = "movement_beef_return";
const OCCURRED_AT = "2026-11-13T18:00:00.000Z";
const UNIT_COST = 1_500;

const openLedger = () =>
  StockLedger.open({
    tenantId: TENANT_ID,
    locationId: LOCATION_ID,
  });

const movement = (input: {
  id: string;
  type: (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE];
  quantity: number;
}) => ({
  ingredientId: BEEF_ID,
  unitCost: UNIT_COST,
  reference: "order_line_1",
  occurredAt: OCCURRED_AT,
  ...input,
});

it("given movements of +1000 g, -700 g and -500 g, when the balance is read, then it is -200 g", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: "movement_return_1000",
      type: MOVEMENT_TYPE.SALE_RETURN,
      quantity: 1000 * QUANTITY_SCALE,
    }),
  );
  ledger.append(
    movement({
      id: "movement_consumption_700",
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      quantity: -700 * QUANTITY_SCALE,
    }),
  );
  ledger.append(
    movement({
      id: "movement_waste_500",
      type: MOVEMENT_TYPE.WASTE,
      quantity: -500 * QUANTITY_SCALE,
    }),
  );

  expect(ledger.balance(BEEF_ID)).toBe(-200 * QUANTITY_SCALE);
  expect(ledger.movements.map((item) => item.quantity)).toEqual([
    1000 * QUANTITY_SCALE,
    -700 * QUANTITY_SCALE,
    -500 * QUANTITY_SCALE,
  ]);
});

it("given an existing movement, when an actor tries to change or delete it, then the operation is rejected and the movement is unchanged", () => {
  const ledger = openLedger();
  ledger.append(
    movement({
      id: MOVEMENT_ID,
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      quantity: -200 * QUANTITY_SCALE,
    }),
  );
  const before = ledger.movements;

  const change = () => {
    ledger.change(MOVEMENT_ID, { quantity: 0 });
  };
  const remove = () => {
    ledger.delete(MOVEMENT_ID);
  };

  expect(change).toThrow(MovementImmutable);
  expect(remove).toThrow(MovementImmutable);
  expect(ledger.movements).toEqual(before);
  expect(ledger.balance(BEEF_ID)).toBe(-200 * QUANTITY_SCALE);
});

it("given a sale consumption already reversed, when it is reversed again, then the second reversal is rejected", () => {
  const ledger = openLedger();
  ledger.append(
    movement({
      id: MOVEMENT_ID,
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      quantity: -200 * QUANTITY_SCALE,
    }),
  );

  ledger.reverse({
    id: REVERSAL_ID,
    movementId: MOVEMENT_ID,
    reference: "void_line_1",
    occurredAt: OCCURRED_AT,
  });
  const afterFirst = ledger.movements;

  const again = () => {
    ledger.reverse({
      id: "movement_beef_return_again",
      movementId: MOVEMENT_ID,
      reference: "void_line_1",
      occurredAt: OCCURRED_AT,
    });
  };

  expect(again).toThrow(MovementAlreadyReversed);
  expect(ledger.movements).toEqual(afterFirst);
  expect(ledger.movements).toHaveLength(2);
  expect(ledger.movements[0]).toMatchObject({
    id: MOVEMENT_ID,
    quantity: -200 * QUANTITY_SCALE,
    type: MOVEMENT_TYPE.SALE_CONSUMPTION,
    unitCost: UNIT_COST,
  });
  expect(ledger.movements[1]).toMatchObject({
    id: REVERSAL_ID,
    quantity: 200 * QUANTITY_SCALE,
    type: MOVEMENT_TYPE.SALE_RETURN,
    unitCost: UNIT_COST,
    reversesMovementId: MOVEMENT_ID,
  });
  expect(ledger.balance(BEEF_ID)).toBe(0);
});

it("given a movement type outside sale consumption, sale return and waste, when it is appended, then the write is rejected", () => {
  const ledger = openLedger();
  const blocked = [
    MOVEMENT_TYPE.PURCHASE,
    MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
    MOVEMENT_TYPE.PRODUCTION_OUTPUT,
    MOVEMENT_TYPE.TRANSFER_OUT,
    MOVEMENT_TYPE.TRANSFER_IN,
    MOVEMENT_TYPE.COUNT_ADJUSTMENT,
  ];

  for (const type of blocked) {
    const append = () => {
      ledger.append(
        movement({
          id: `movement_${type}`,
          type,
          quantity: QUANTITY_SCALE,
        }),
      );
    };

    expect(append).toThrow(MovementTypeNotWritable);
  }

  expect(ledger.movements).toEqual([]);
  expect(ledger.balance(BEEF_ID)).toBe(0);
});
