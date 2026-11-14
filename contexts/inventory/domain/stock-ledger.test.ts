import { expect, it } from "vitest";

import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import {
  InvalidQuantity,
  MOVEMENT_TYPE,
  MovementAlreadyReversed,
  MovementImmutable,
  nextAverageCost,
  onHandDelta,
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
  unitCost?: number;
  reversesMovementId?: string;
  occurredAt?: string;
}) => ({
  ingredientId: BEEF_ID,
  unitCost: UNIT_COST,
  reference: "order_line_1",
  occurredAt: OCCURRED_AT,
  ...input,
});

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

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

it("given a purchase above zero, when it is appended, then the ledger keeps it and the balance rises", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: "movement_purchase_1000",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(1000),
      unitCost: 10,
    }),
  );

  expect(ledger.movements).toEqual([
    {
      id: "movement_purchase_1000",
      locationId: LOCATION_ID,
      ingredientId: BEEF_ID,
      quantity: grams(1000),
      unitCost: 10,
      type: MOVEMENT_TYPE.PURCHASE,
      reference: "order_line_1",
      occurredAt: OCCURRED_AT,
    },
  ]);
  expect(ledger.balance(BEEF_ID)).toBe(grams(1000));
  expect(ledger.averageCost(BEEF_ID)).toBe(10);
});

it("given a purchase quantity of zero or below, when it is appended, then the write is rejected", () => {
  const ledger = openLedger();

  for (const quantity of [0, grams(-1)]) {
    const append = () => {
      ledger.append(
        movement({
          id: `movement_purchase_${quantity}`,
          type: MOVEMENT_TYPE.PURCHASE,
          quantity,
        }),
      );
    };

    expect(append).toThrow(InvalidQuantity);
  }

  expect(ledger.movements).toEqual([]);
  expect(ledger.balance(BEEF_ID)).toBe(0);
});

it("given 1000 g at 10 COP/g, when 1000 g arrive at 14 COP/g, then the average is 12 COP/g", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(1000),
      unitCost: 10,
    }),
  );
  ledger.append(
    movement({
      id: "movement_purchase_14",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(1000),
      unitCost: 14,
    }),
  );

  expect(
    nextAverageCost({
      onHand: grams(1000),
      averageCost: 10,
      receivedQuantity: grams(1000),
      receiptCost: 14,
    }),
  ).toBe(12);
  expect(
    nextAverageCost({
      onHand: 1,
      averageCost: 10,
      receivedQuantity: 1,
      receiptCost: 11,
    }),
  ).toBe(11);
  expect(ledger.averageCost(BEEF_ID)).toBe(12);
  expect(ledger.balance(BEEF_ID)).toBe(grams(2000));
});

it("given on-hand at or below zero, when a purchase arrives, then the average becomes the receipt cost", () => {
  expect(
    nextAverageCost({
      onHand: 0,
      averageCost: 12,
      receivedQuantity: grams(1000),
      receiptCost: 20,
    }),
  ).toBe(20);
  expect(
    nextAverageCost({
      onHand: grams(-200),
      averageCost: 12,
      receivedQuantity: grams(1000),
      receiptCost: 20,
    }),
  ).toBe(20);

  const empty = openLedger();
  empty.append(
    movement({
      id: "movement_purchase_onto_empty",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(1000),
      unitCost: 20,
    }),
  );
  expect(empty.averageCost(BEEF_ID)).toBe(20);

  const negative = openLedger();
  negative.append(
    movement({
      id: "movement_consumption_before_purchase",
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      quantity: grams(-200),
    }),
  );
  negative.append(
    movement({
      id: "movement_purchase_after_negative",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(1000),
      unitCost: 20,
    }),
  );

  expect(negative.balance(BEEF_ID)).toBe(grams(800));
  expect(negative.averageCost(BEEF_ID)).toBe(20);
});

it("given an average of 12 COP/g, when waste is recorded, then the average stays 12 COP/g", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(1000),
      unitCost: 10,
    }),
  );
  ledger.append(
    movement({
      id: "movement_purchase_14",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(1000),
      unitCost: 14,
    }),
  );
  ledger.append(
    movement({
      id: "movement_waste_200",
      type: MOVEMENT_TYPE.WASTE,
      quantity: grams(-200),
    }),
  );

  expect(ledger.balance(BEEF_ID)).toBe(grams(1800));
  expect(ledger.averageCost(BEEF_ID)).toBe(12);
});

it("given waste that reverses a sale consumption of the same ingredient, when the balance is read, then on-hand does not move again", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: MOVEMENT_ID,
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      quantity: grams(-200),
    }),
  );
  ledger.append(
    movement({
      id: "movement_waste_of_sale",
      type: MOVEMENT_TYPE.WASTE,
      quantity: grams(-200),
      reversesMovementId: MOVEMENT_ID,
    }),
  );

  expect(ledger.balance(BEEF_ID)).toBe(grams(-200));
  expect(onHandDelta(ledger.movements[1], [ledger.movements[0]])).toBe(0);
  expect(ledger.movements[1]).toMatchObject({
    type: MOVEMENT_TYPE.WASTE,
    reversesMovementId: MOVEMENT_ID,
  });
});

it("given 10 g purchased at 10 COP/g, when 1 g is transferred out, then on-hand is 9 g and the average stays 10", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 10,
    }),
  );
  ledger.append(
    movement({
      id: "movement_transfer_out_1",
      type: MOVEMENT_TYPE.TRANSFER_OUT,
      quantity: grams(-1),
      unitCost: 10,
    }),
  );

  expect(ledger.balance(BEEF_ID)).toBe(grams(9));
  expect(ledger.averageCost(BEEF_ID)).toBe(10);
  expect(ledger.movements.map((item) => item.quantity)).toEqual([
    grams(10),
    grams(-1),
  ]);
});

it("given a purchase of 10 g at 10 COP/g, when 5 g are transferred in at 12 COP/g, then the quantity is positive and the average is 11", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 10,
    }),
  );
  ledger.append(
    movement({
      id: "movement_transfer_in_5",
      type: MOVEMENT_TYPE.TRANSFER_IN,
      quantity: grams(5),
      unitCost: 12,
    }),
  );

  expect(ledger.balance(BEEF_ID)).toBe(grams(15));
  expect(ledger.averageCost(BEEF_ID)).toBe(11);
  expect(ledger.movements[1]).toMatchObject({
    type: MOVEMENT_TYPE.TRANSFER_IN,
    quantity: grams(5),
    unitCost: 12,
  });
});

it("given a production consumption above zero or a production output below zero, when it is appended, then the write is rejected", () => {
  const ledger = openLedger();

  const consumption = () => {
    ledger.append(
      movement({
        id: "movement_production_consumption_positive",
        type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
        quantity: grams(1),
      }),
    );
  };
  const output = () => {
    ledger.append(
      movement({
        id: "movement_production_output_negative",
        type: MOVEMENT_TYPE.PRODUCTION_OUTPUT,
        quantity: grams(-1),
      }),
    );
  };

  expect(consumption).toThrow(InvalidQuantity);
  expect(output).toThrow(InvalidQuantity);
  expect(ledger.movements).toEqual([]);
});

it("given 10 g at 10 COP/g, when 1 g is consumed in production, then on-hand is 9 g and the average stays 10", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 10,
    }),
  );
  ledger.append(
    movement({
      id: "movement_production_consumption_1",
      type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
      quantity: grams(-1),
      unitCost: 10,
    }),
  );

  expect(ledger.balance(BEEF_ID)).toBe(grams(9));
  expect(ledger.averageCost(BEEF_ID)).toBe(10);
  expect(ledger.movements[1]).toMatchObject({
    type: MOVEMENT_TYPE.PRODUCTION_CONSUMPTION,
    quantity: grams(-1),
  });
});

it("given 10 g at 10 COP/g, when 5 g are produced at 12 COP/g, then the output is positive and the average is 11", () => {
  const ledger = openLedger();

  ledger.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 10,
    }),
  );
  ledger.append(
    movement({
      id: "movement_production_output_5",
      type: MOVEMENT_TYPE.PRODUCTION_OUTPUT,
      quantity: grams(5),
      unitCost: 12,
    }),
  );

  expect(ledger.balance(BEEF_ID)).toBe(grams(15));
  expect(ledger.averageCost(BEEF_ID)).toBe(11);
  expect(ledger.averageCost(BEEF_ID)).toBe(
    nextAverageCost({
      onHand: grams(10),
      averageCost: 10,
      receivedQuantity: grams(5),
      receiptCost: 12,
    }),
  );
  expect(ledger.movements[1]).toMatchObject({
    type: MOVEMENT_TYPE.PRODUCTION_OUTPUT,
    quantity: grams(5),
    unitCost: 12,
  });
});

it("given a purchase, when reverse is called, then the reversal is rejected and the purchase stays", () => {
  const ledger = openLedger();
  ledger.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 10,
    }),
  );
  const before = ledger.movements;

  const reversePurchase = () => {
    ledger.reverse({
      id: REVERSAL_ID,
      movementId: "movement_purchase_10",
      reference: "void_line_1",
      occurredAt: OCCURRED_AT,
    });
  };

  expect(reversePurchase).toThrow(MovementAlreadyReversed);
  expect(ledger.movements).toEqual(before);
  expect(ledger.balance(BEEF_ID)).toBe(grams(10));
  expect(ledger.averageCost(BEEF_ID)).toBe(10);
});

it("given a transfer out above zero or a transfer in below zero, when it is appended, then the write is rejected", () => {
  const ledger = openLedger();

  const transferOut = () => {
    ledger.append(
      movement({
        id: "movement_transfer_out_positive",
        type: MOVEMENT_TYPE.TRANSFER_OUT,
        quantity: grams(1),
      }),
    );
  };
  const transferIn = () => {
    ledger.append(
      movement({
        id: "movement_transfer_in_negative",
        type: MOVEMENT_TYPE.TRANSFER_IN,
        quantity: grams(-1),
      }),
    );
  };

  expect(transferOut).toThrow(InvalidQuantity);
  expect(transferIn).toThrow(InvalidQuantity);
  expect(ledger.movements).toEqual([]);
});

it("given 10 g at 10 COP/g, when a nonzero count adjustment is appended at another cost, then either sign is kept and the average stays 10", () => {
  const positive = openLedger();

  positive.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 10,
    }),
  );
  positive.append(
    movement({
      id: "movement_count_plus_5",
      type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
      quantity: grams(5),
      unitCost: 12,
    }),
  );

  expect(positive.balance(BEEF_ID)).toBe(grams(15));
  expect(positive.averageCost(BEEF_ID)).toBe(10);
  expect(positive.averageCost(BEEF_ID)).not.toBe(
    nextAverageCost({
      onHand: grams(10),
      averageCost: 10,
      receivedQuantity: grams(5),
      receiptCost: 12,
    }),
  );
  expect(positive.movements[1]).toMatchObject({
    type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    quantity: grams(5),
    unitCost: 12,
  });

  const negative = openLedger();

  negative.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 10,
    }),
  );
  negative.append(
    movement({
      id: "movement_count_minus_1",
      type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
      quantity: grams(-1),
      unitCost: 12,
    }),
  );

  expect(negative.balance(BEEF_ID)).toBe(grams(9));
  expect(negative.averageCost(BEEF_ID)).toBe(10);
  expect(negative.movements[1]).toMatchObject({
    type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
    quantity: grams(-1),
  });
});

it("given a count adjustment of zero, when it is appended, then the write is rejected", () => {
  const ledger = openLedger();

  const append = () => {
    ledger.append(
      movement({
        id: "movement_count_zero",
        type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
        quantity: 0,
      }),
    );
  };

  expect(append).toThrow(InvalidQuantity);
  expect(ledger.movements).toEqual([]);
});

it("given a count adjustment, when an actor tries to change or delete it, then the operation is rejected and the movement is unchanged", () => {
  const ledger = openLedger();
  ledger.append(
    movement({
      id: "movement_count_plus_5",
      type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
      quantity: grams(5),
      unitCost: 12,
    }),
  );
  const before = ledger.movements;

  const change = () => {
    ledger.change("movement_count_plus_5", { quantity: grams(1) });
  };
  const remove = () => {
    ledger.delete("movement_count_plus_5");
  };

  expect(change).toThrow(MovementImmutable);
  expect(remove).toThrow(MovementImmutable);
  expect(ledger.movements).toEqual(before);
  expect(ledger.balance(BEEF_ID)).toBe(grams(5));
  expect(ledger.averageCost(BEEF_ID)).toBe(0);
});

it("given a sale, its reversal waste, and a count at the cut-off, when later lines arrive, then balanceUntil and averageCostUntil ignore them", () => {
  const ledger = openLedger();
  const later = "2026-11-13T19:00:00.000Z";

  ledger.append(
    movement({
      id: "movement_purchase_10",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 10,
    }),
  );
  ledger.append(
    movement({
      id: MOVEMENT_ID,
      type: MOVEMENT_TYPE.SALE_CONSUMPTION,
      quantity: grams(-2),
    }),
  );
  ledger.append(
    movement({
      id: "movement_waste_of_sale",
      type: MOVEMENT_TYPE.WASTE,
      quantity: grams(-2),
      reversesMovementId: MOVEMENT_ID,
    }),
  );
  ledger.append(
    movement({
      id: "movement_count_plus_5",
      type: MOVEMENT_TYPE.COUNT_ADJUSTMENT,
      quantity: grams(5),
      unitCost: 12,
    }),
  );
  ledger.append(
    movement({
      id: "movement_purchase_later",
      type: MOVEMENT_TYPE.PURCHASE,
      quantity: grams(10),
      unitCost: 14,
      occurredAt: later,
    }),
  );

  expect(onHandDelta(ledger.movements[2], ledger.movements.slice(0, 2))).toBe(
    0,
  );
  expect(ledger.balanceUntil(BEEF_ID, OCCURRED_AT)).toBe(grams(13));
  expect(ledger.averageCostUntil(BEEF_ID, OCCURRED_AT)).toBe(10);
  expect(ledger.balance(BEEF_ID)).toBe(grams(23));
  expect(ledger.averageCost(BEEF_ID)).toBe(12);
});
