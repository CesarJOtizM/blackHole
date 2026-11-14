import { expect, it } from "vitest";
import {
  DuplicateId,
  OverReceipt,
  PURCHASE_ORDER_STATUS,
  PurchaseOrder,
  PurchaseOrderClosed,
  Purchasing,
  toBaseReceipt,
} from "#domain/purchasing.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const SUPPLIER_ID = "supplier_market";
const ORDER_ID = "purchase_order_tomato";
const LINE_ID = "line_tomato";
const KG_FACTOR = 1000 * QUANTITY_SCALE;

const supplier = {
  id: SUPPLIER_ID,
  identification: "900123456",
  name: "Market",
  issuesEInvoices: false,
  leadTimeDays: 2,
};

const orderInput = (id: string, purchaseQuantity = 10) => ({
  id,
  supplierId: SUPPLIER_ID,
  locationId: LOCATION_ID,
  lines: [
    {
      id: LINE_ID,
      ingredientId: TOMATO_ID,
      purchaseQuantity,
      factor: KG_FACTOR,
    },
  ],
});

const receipt = (
  receiptId: string,
  purchaseQuantity: number,
  purchaseUnitCost: number,
) => ({
  receiptId,
  lines: [
    {
      lineId: LINE_ID,
      purchaseQuantity,
      purchaseUnitCost,
    },
  ],
});

it("given a supplier and a purchase order, when the same id is registered again, then it is rejected", () => {
  const purchasing = Purchasing.open({ tenantId: TENANT_ID });
  purchasing.registerSupplier(supplier);
  purchasing.openOrder(orderInput(ORDER_ID));

  const registerAgain = () => {
    purchasing.registerSupplier(supplier);
  };
  const openAgain = () => {
    purchasing.openOrder(orderInput(ORDER_ID));
  };

  expect(registerAgain).toThrow(DuplicateId);
  expect(openAgain).toThrow(DuplicateId);
  expect(purchasing.suppliers).toEqual([supplier]);
  expect(purchasing.orders).toHaveLength(1);
});

it("given 5 kg at 4000 COP/kg, when converted with the scaled kilogram factor, then it is 5000 g at 4 COP/g", () => {
  const line = toBaseReceipt({
    purchaseQuantity: 5,
    purchaseUnitCost: 4000,
    factor: KG_FACTOR,
  });

  expect(line).toEqual({
    purchaseQuantity: 5,
    purchaseUnitCost: 4000,
    factor: KG_FACTOR,
    quantity: 5000 * QUANTITY_SCALE,
    unitCost: 4,
  });
});

it("given 5 kg at 4500 COP/kg, when the line is received, then the base cost is 5 COP/g and the line keeps 4500", () => {
  const order = PurchaseOrder.open(orderInput(ORDER_ID, 5));

  const [line] = order.receive(receipt("receipt_4500", 5, 4500));

  expect(line).toMatchObject({
    purchaseQuantity: 5,
    purchaseUnitCost: 4500,
    factor: KG_FACTOR,
    quantity: 5000 * QUANTITY_SCALE,
    unitCost: 5,
  });
  expect(order.status).toBe(PURCHASE_ORDER_STATUS.RECEIVED);
});

it("given a closed order or a quantity above the remainder, when a receipt is attempted, then it is rejected", () => {
  const cancelled = PurchaseOrder.open(orderInput("purchase_order_cancelled"));
  cancelled.cancel();
  const cancelledLines = cancelled.lines;

  const receiveCancelled = () => {
    cancelled.receive(receipt("receipt_cancelled", 5, 4000));
  };

  expect(cancelled.status).toBe(PURCHASE_ORDER_STATUS.CANCELLED);
  expect(receiveCancelled).toThrow(PurchaseOrderClosed);
  expect(cancelled.lines).toEqual(cancelledLines);

  const received = PurchaseOrder.open(orderInput("purchase_order_received"));
  received.receive(receipt("receipt_full", 10, 4000));

  const receiveAgain = () => {
    received.receive(receipt("receipt_extra", 1, 4000));
  };

  expect(received.status).toBe(PURCHASE_ORDER_STATUS.RECEIVED);
  expect(receiveAgain).toThrow(PurchaseOrderClosed);

  const open = PurchaseOrder.open(orderInput("purchase_order_open"));
  const openLines = open.lines;

  const receiveTooMuch = () => {
    open.receive(receipt("receipt_over", 11, 4000));
  };

  expect(receiveTooMuch).toThrow(OverReceipt);
  expect(open.status).toBe(PURCHASE_ORDER_STATUS.OPEN);
  expect(open.lines).toEqual(openLines);

  const partial = PurchaseOrder.open(orderInput("purchase_order_partial"));
  partial.receive(receipt("receipt_six", 6, 4000));
  const partialLines = partial.lines;

  const receivePastRemainder = () => {
    partial.receive(receipt("receipt_five", 5, 4000));
  };

  expect(partial.status).toBe(PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED);
  expect(partialLines[0]?.receivedQuantity).toBe(6);
  expect(receivePastRemainder).toThrow(OverReceipt);
  expect(partial.lines).toEqual(partialLines);
});

it("given an order line with a frozen kilogram factor, when it is received, then conversion keeps that factor", () => {
  const order = PurchaseOrder.open(orderInput(ORDER_ID));

  const [line] = order.receive(receipt("receipt_partial", 5, 4000));

  expect(order.lines[0]).toMatchObject({
    factor: KG_FACTOR,
    receivedQuantity: 5,
  });
  expect(line).toEqual({
    lineId: LINE_ID,
    ingredientId: TOMATO_ID,
    purchaseQuantity: 5,
    purchaseUnitCost: 4000,
    factor: KG_FACTOR,
    quantity: 5000 * QUANTITY_SCALE,
    unitCost: 4,
  });
  expect(order.status).toBe(PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED);
  expect(
    toBaseReceipt({
      purchaseQuantity: 5,
      purchaseUnitCost: 4000,
      factor: 500 * QUANTITY_SCALE,
    }).unitCost,
  ).toBe(8);
});
