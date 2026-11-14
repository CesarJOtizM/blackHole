import { expect, it } from "vitest";

import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";
import {
  InsufficientOnHand,
  suggestReplenishment,
  TRANSFER_STATUS,
  Transfer,
  TransferNotInTransit,
} from "#domain/transfer.js";

const ORIGIN_ID = "location_central_warehouse";
const DESTINATION_ID = "location_point_of_sale";
const BEEF_ID = "ingredient_beef";
const TRANSFER_ID = "transfer_beef";
const ACTOR_ID = "user_keeper";
const DISPATCHED_AT = "2026-11-13T18:00:00.000Z";
const RECEIVED_AT = "2026-11-13T19:00:00.000Z";

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const requestTransfer = (quantity: number) =>
  Transfer.request({
    id: TRANSFER_ID,
    originLocationId: ORIGIN_ID,
    destinationLocationId: DESTINATION_ID,
    lines: [{ ingredientId: BEEF_ID, quantity }],
  });

const dispatchTransfer = (
  quantity: number,
  averageCost: number,
  onHand = quantity,
) => {
  const transfer = requestTransfer(quantity);
  transfer.dispatch({
    actorId: ACTOR_ID,
    occurredAt: DISPATCHED_AT,
    origin: [{ ingredientId: BEEF_ID, onHand, averageCost }],
  });
  return transfer;
};

it("given a requested transfer, when it is dispatched, then dispatched and in transit are stamped together and the out movement copies the origin average", () => {
  const transfer = requestTransfer(10);

  const movements = transfer.dispatch({
    actorId: ACTOR_ID,
    occurredAt: DISPATCHED_AT,
    origin: [{ ingredientId: BEEF_ID, onHand: 10, averageCost: 12 }],
  });

  expect(transfer.status).toBe(TRANSFER_STATUS.IN_TRANSIT);
  expect(transfer.dispatchedAt).toBe(DISPATCHED_AT);
  expect(transfer.inTransitAt).toBe(DISPATCHED_AT);
  expect(transfer.dispatchedBy).toBe(ACTOR_ID);
  expect(movements).toEqual([
    {
      ingredientId: BEEF_ID,
      type: MOVEMENT_TYPE.TRANSFER_OUT,
      quantity: -10,
      unitCost: 12,
    },
  ]);
  expect(transfer.lines[0]).toMatchObject({
    quantity: 10,
    unitCost: 12,
  });
});

it("given a requested transfer, when receipt is attempted before dispatch, then it is rejected", () => {
  const transfer = requestTransfer(10);

  const receive = () => {
    transfer.receive({
      actorId: ACTOR_ID,
      occurredAt: RECEIVED_AT,
      lines: [
        {
          ingredientId: BEEF_ID,
          receivedQuantity: 10,
          onHand: 0,
          averageCost: 0,
        },
      ],
    });
  };

  expect(receive).toThrow(TransferNotInTransit);
  expect(transfer.status).toBe(TRANSFER_STATUS.REQUESTED);
  expect(transfer.dispatchedAt).toBeUndefined();
  expect(transfer.lines[0]?.receivedQuantity).toBeUndefined();
});

it("given 10 base units dispatched at 12 COP, when 9 are received, then the shortfall stays on the line at that cost", () => {
  const transfer = dispatchTransfer(10, 12);
  const onHand = grams(1000);

  const result = transfer.receive({
    actorId: ACTOR_ID,
    occurredAt: RECEIVED_AT,
    lines: [
      {
        ingredientId: BEEF_ID,
        receivedQuantity: 9,
        onHand,
        averageCost: 10,
      },
    ],
  });

  expect(transfer.status).toBe(TRANSFER_STATUS.RECEIVED_WITH_DIFFERENCES);
  expect(transfer.receivedAt).toBe(RECEIVED_AT);
  expect(transfer.receivedBy).toBe(ACTOR_ID);
  expect(transfer.lines[0]).toMatchObject({
    quantity: 10,
    receivedQuantity: 9,
    shortfall: 1,
    unitCost: 12,
  });
  expect(result.movements).toEqual([
    {
      ingredientId: BEEF_ID,
      type: MOVEMENT_TYPE.TRANSFER_IN,
      quantity: 9,
      unitCost: 12,
    },
  ]);
  expect(result.averages).toEqual([
    {
      ingredientId: BEEF_ID,
      averageCost: nextAverageCost({
        onHand,
        averageCost: 10,
        receivedQuantity: 9,
        receiptCost: 12,
      }),
    },
  ]);
});

it("given origin cost 12 COP/g and destination 1000 g at 10 COP/g, when 1000 g are received, then the destination average is 11", () => {
  const transfer = dispatchTransfer(grams(1000), 12);

  const result = transfer.receive({
    actorId: ACTOR_ID,
    occurredAt: RECEIVED_AT,
    lines: [
      {
        ingredientId: BEEF_ID,
        receivedQuantity: grams(1000),
        onHand: grams(1000),
        averageCost: 10,
      },
    ],
  });

  expect(transfer.status).toBe(TRANSFER_STATUS.RECEIVED);
  expect(transfer.lines[0]?.shortfall).toBe(0);
  expect(result.movements).toEqual([
    {
      ingredientId: BEEF_ID,
      type: MOVEMENT_TYPE.TRANSFER_IN,
      quantity: grams(1000),
      unitCost: 12,
    },
  ]);
  expect(result.averages).toEqual([{ ingredientId: BEEF_ID, averageCost: 11 }]);
});

it("given destination on-hand at or below zero, when the transfer is received, then the average becomes the copied receipt cost", () => {
  const ontoEmpty = dispatchTransfer(grams(1000), 12);
  const ontoNegative = dispatchTransfer(grams(1000), 12);

  const emptyResult = ontoEmpty.receive({
    actorId: ACTOR_ID,
    occurredAt: RECEIVED_AT,
    lines: [
      {
        ingredientId: BEEF_ID,
        receivedQuantity: grams(1000),
        onHand: 0,
        averageCost: 10,
      },
    ],
  });
  const negativeResult = ontoNegative.receive({
    actorId: ACTOR_ID,
    occurredAt: RECEIVED_AT,
    lines: [
      {
        ingredientId: BEEF_ID,
        receivedQuantity: grams(1000),
        onHand: grams(-200),
        averageCost: 10,
      },
    ],
  });

  expect(emptyResult.averages[0]?.averageCost).toBe(12);
  expect(negativeResult.averages[0]?.averageCost).toBe(12);
  expect(emptyResult.movements[0]?.unitCost).toBe(12);
  expect(negativeResult.movements[0]?.unitCost).toBe(12);
});

it("given origin on-hand below the dispatch quantity, when dispatch is attempted, then it is rejected and nothing is stamped", () => {
  const transfer = requestTransfer(6);

  const dispatch = () => {
    transfer.dispatch({
      actorId: ACTOR_ID,
      occurredAt: DISPATCHED_AT,
      origin: [{ ingredientId: BEEF_ID, onHand: 5, averageCost: 12 }],
    });
  };

  expect(dispatch).toThrow(InsufficientOnHand);
  expect(transfer.status).toBe(TRANSFER_STATUS.REQUESTED);
  expect(transfer.dispatchedAt).toBeUndefined();
  expect(transfer.inTransitAt).toBeUndefined();
  expect(transfer.lines[0]?.unitCost).toBeUndefined();
});

it("given minimum 5, maximum 20 and on-hand 4, when replenishment is suggested, then the suggestion is 16", () => {
  expect(suggestReplenishment({ onHand: 4, minimum: 5, maximum: 20 })).toBe(16);
});

it("given on-hand below the minimum, when replenishment is suggested, then the suggestion is maximum minus on-hand", () => {
  expect(suggestReplenishment({ onHand: 3, minimum: 10, maximum: 25 })).toBe(
    22,
  );
});

it("given on-hand at or above the minimum, when replenishment is suggested, then nothing is suggested", () => {
  expect(
    suggestReplenishment({ onHand: 5, minimum: 5, maximum: 20 }),
  ).toBeUndefined();
  expect(
    suggestReplenishment({ onHand: 20, minimum: 5, maximum: 20 }),
  ).toBeUndefined();
});
