import { expect, it } from "vitest";

import { InMemoryPurchasingRepository } from "#adapters/memory/in-memory-purchasing-repository.js";
import { CreatePurchaseOrder } from "#application/create-purchase-order/create-purchase-order.js";
import { CreateSupplier } from "#application/create-supplier/create-supplier.js";
import { PURCHASE_ORDER_STATUS } from "#domain/purchasing.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const SUPPLIER_ID = "supplier_market";
const ORDER_ID = "purchase_order_tomato";
const LINE_ID = "line_tomato";
const KG_FACTOR = 1000 * QUANTITY_SCALE;

it("given one supplier and one location, when an order is created in purchase units, then it stays open and the line factor is frozen", async () => {
  const purchasing = new InMemoryPurchasingRepository();
  const createSupplier = new CreateSupplier(purchasing);
  const createOrder = new CreatePurchaseOrder(purchasing);
  await createSupplier.execute({
    tenantId: TENANT_ID,
    id: SUPPLIER_ID,
    identification: "900123456",
    name: "Market",
    issuesEInvoices: false,
    leadTimeDays: 2,
  });

  const order = await createOrder.execute({
    tenantId: TENANT_ID,
    id: ORDER_ID,
    supplierId: SUPPLIER_ID,
    locationId: LOCATION_ID,
    lines: [
      {
        id: LINE_ID,
        ingredientId: TOMATO_ID,
        purchaseQuantity: 5,
        factor: KG_FACTOR,
      },
    ],
  });

  expect(order.status).toBe(PURCHASE_ORDER_STATUS.OPEN);
  expect(order.supplierId).toBe(SUPPLIER_ID);
  expect(order.locationId).toBe(LOCATION_ID);
  expect(order.lines).toEqual([
    {
      id: LINE_ID,
      ingredientId: TOMATO_ID,
      purchaseQuantity: 5,
      receivedQuantity: 0,
      factor: KG_FACTOR,
    },
  ]);

  const stored = (await purchasing.load(TENANT_ID))?.orders.find(
    (item) => item.id === ORDER_ID,
  );

  expect(stored?.status).toBe(PURCHASE_ORDER_STATUS.OPEN);
  expect(stored?.supplierId).toBe(SUPPLIER_ID);
  expect(stored?.locationId).toBe(LOCATION_ID);
  expect(stored?.lines).toEqual(order.lines);
  expect(stored?.lines[0]?.purchaseQuantity).toBe(5);
  expect(stored?.lines[0]?.factor).toBe(KG_FACTOR);
});
