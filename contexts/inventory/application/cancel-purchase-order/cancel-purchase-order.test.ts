import { expect, it } from "vitest";

import { InMemoryPurchasingRepository } from "#adapters/memory/in-memory-purchasing-repository.js";
import { InMemoryStockLedgerRepository } from "#adapters/memory/in-memory-stock-ledger-repository.js";
import { CancelPurchaseOrder } from "#application/cancel-purchase-order/cancel-purchase-order.js";
import { CreatePurchaseOrder } from "#application/create-purchase-order/create-purchase-order.js";
import { CreateSupplier } from "#application/create-supplier/create-supplier.js";
import type { AppendStock } from "#application/ports/stock-ledger-repository.js";
import {
  PURCHASE_ORDER_STATUS,
  PurchaseOrderClosed,
} from "#domain/purchasing.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";

const TENANT_ID = "organization_tenant_1";
const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const SUPPLIER_ID = "supplier_market";
const ORDER_ID = "purchase_order_tomato";
const LINE_ID = "line_tomato";
const KG_FACTOR = 1000 * QUANTITY_SCALE;

class GuardedLedger extends InMemoryStockLedgerRepository {
  override async append(_input: AppendStock): Promise<void> {
    throw new Error("Cancel wrote a stock movement.");
  }
}

it("given an open order, when it is cancelled, then no stock movement is written and a later receipt is rejected", async () => {
  const purchasing = new InMemoryPurchasingRepository();
  const ledger = new GuardedLedger();
  const createSupplier = new CreateSupplier(purchasing);
  const createOrder = new CreatePurchaseOrder(purchasing);
  const cancel = new CancelPurchaseOrder(purchasing, ledger);
  await createSupplier.execute({
    tenantId: TENANT_ID,
    id: SUPPLIER_ID,
    identification: "900123456",
    name: "Market",
    issuesEInvoices: false,
    leadTimeDays: 2,
  });
  const opened = await createOrder.execute({
    tenantId: TENANT_ID,
    id: ORDER_ID,
    supplierId: SUPPLIER_ID,
    locationId: LOCATION_ID,
    lines: [
      {
        id: LINE_ID,
        ingredientId: TOMATO_ID,
        purchaseQuantity: 10,
        factor: KG_FACTOR,
      },
    ],
  });
  const linesBefore = opened.lines.map((line) => ({ ...line }));

  await cancel.execute({
    tenantId: TENANT_ID,
    purchaseOrderId: ORDER_ID,
  });

  const stored = (await purchasing.load(TENANT_ID))?.orders.find(
    (item) => item.id === ORDER_ID,
  );

  if (!stored) {
    throw new Error("Expected the cancelled order.");
  }

  const receiveLater = () => {
    stored.receive({
      receiptId: "receipt_later",
      lines: [
        {
          lineId: LINE_ID,
          purchaseQuantity: 5,
          purchaseUnitCost: 4000,
        },
      ],
    });
  };

  expect(stored.status).toBe(PURCHASE_ORDER_STATUS.CANCELLED);
  expect(stored.lines).toEqual(linesBefore);
  expect(receiveLater).toThrow(PurchaseOrderClosed);
  expect(stored.status).toBe(PURCHASE_ORDER_STATUS.CANCELLED);
  expect(stored.lines[0]?.receivedQuantity).toBe(0);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(0);
});
