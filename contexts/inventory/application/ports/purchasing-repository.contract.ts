import { expect, it } from "vitest";

import type {
  PurchaseReceipt,
  PurchasingRepository,
} from "#application/ports/purchasing-repository.js";
import { PURCHASE_ORDER_STATUS, Purchasing } from "#domain/purchasing.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const LOCATION_ID = "location_point_of_sale";
const TOMATO_ID = "ingredient_tomato";
const ACTOR_ID = "user_kitchen_chief";
const OCCURRED_AT = "2026-06-01T12:00:00.000Z";
const KG_FACTOR = 1000 * QUANTITY_SCALE;
const ORDER_ID = "purchase_order_tomato";
const LINE_ID = "line_tomato";

export interface StoredPurchaseMovement {
  id: string;
  tenantId: string;
  locationId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  type: typeof MOVEMENT_TYPE.PURCHASE;
  reference: string;
  occurredAt: string;
  actorId: string;
  orderLineId: null;
  role: null;
  recipeVersion: null;
}

export interface PurchasingContractSubject {
  purchasing: PurchasingRepository;
  balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;
  averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number>;
  movements(tenantId: string): Promise<readonly StoredPurchaseMovement[]>;
  receipts(tenantId: string): Promise<readonly PurchaseReceipt[]>;
  outboxCount(tenantId: string): Promise<number>;
  failOnInsert(ordinal: number): void;
  seedOnHand(quantity: number): Promise<void>;
}

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

const purchaseMovement = (
  receiptId: string,
  quantity: number,
  unitCost: number,
): StoredPurchaseMovement => ({
  id: `movement_${receiptId}_${TOMATO_ID}`,
  tenantId: TENANT_A,
  locationId: LOCATION_ID,
  ingredientId: TOMATO_ID,
  quantity,
  unitCost,
  type: MOVEMENT_TYPE.PURCHASE,
  reference: receiptId,
  occurredAt: OCCURRED_AT,
  actorId: ACTOR_ID,
  orderLineId: null,
  role: null,
  recipeVersion: null,
});

export function purchasingRepositoryContract(
  open: () => PurchasingContractSubject | Promise<PurchasingContractSubject>,
): void {
  it("given 5 kg at 4000 COP/kg, when the receipt is confirmed, then the ledger balance is 5000 g at 4 and the same receipt is a no-op", async () => {
    const subject = await open();
    const quantity = 5000 * QUANTITY_SCALE;
    const receipt = await subject.purchasing.confirm({
      tenantId: TENANT_A,
      receiptId: "receipt_direct",
      locationId: LOCATION_ID,
      actorId: ACTOR_ID,
      occurredAt: OCCURRED_AT,
      purchaseOrderId: null,
      lines: [
        {
          ingredientId: TOMATO_ID,
          purchaseQuantity: 5,
          purchaseUnitCost: 4000,
          publishedFactor: KG_FACTOR,
        },
      ],
    });
    const repeated = await subject.purchasing.confirm({
      tenantId: TENANT_A,
      receiptId: "receipt_direct",
      locationId: LOCATION_ID,
      actorId: ACTOR_ID,
      occurredAt: OCCURRED_AT,
      purchaseOrderId: null,
      lines: [
        {
          ingredientId: TOMATO_ID,
          purchaseQuantity: 9,
          purchaseUnitCost: 100,
          publishedFactor: KG_FACTOR,
        },
      ],
    });

    expect(receipt.lines).toEqual([
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 5,
        purchaseUnitCost: 4000,
        factor: KG_FACTOR,
        quantity,
        unitCost: 4,
      },
    ]);
    expect(repeated).toEqual(receipt);
    expect(await subject.balance(TENANT_A, LOCATION_ID, TOMATO_ID)).toBe(
      quantity,
    );
    expect(await subject.averageCost(TENANT_A, LOCATION_ID, TOMATO_ID)).toBe(4);
    expect(await subject.movements(TENANT_A)).toEqual([
      purchaseMovement("receipt_direct", quantity, 4),
    ]);
    expect(await subject.outboxCount(TENANT_A)).toBe(0);
  });

  it("given stock already on the ledger, when a purchase is confirmed, then the balance includes that purchase once", async () => {
    const subject = await open();
    await subject.seedOnHand(grams(1000));
    const queued = await subject.outboxCount(TENANT_A);

    await subject.purchasing.confirm({
      tenantId: TENANT_A,
      receiptId: "receipt_onto_stock",
      locationId: LOCATION_ID,
      actorId: ACTOR_ID,
      occurredAt: OCCURRED_AT,
      purchaseOrderId: null,
      lines: [
        {
          ingredientId: TOMATO_ID,
          purchaseQuantity: 1000,
          purchaseUnitCost: 20,
          publishedFactor: QUANTITY_SCALE,
        },
      ],
    });

    expect(await subject.balance(TENANT_A, LOCATION_ID, TOMATO_ID)).toBe(
      grams(2000),
    );
    expect(await subject.averageCost(TENANT_A, LOCATION_ID, TOMATO_ID)).toBe(
      10,
    );
    expect(await subject.outboxCount(TENANT_A)).toBe(queued);
    expect(await subject.movements(TENANT_A)).toEqual([
      purchaseMovement("receipt_onto_stock", grams(1000), 20),
    ]);
  });

  it("given a receipt stored for tenant A, when tenant B reads, then tenant A stays hidden", async () => {
    const subject = await open();
    const book = Purchasing.open({ tenantId: TENANT_A });
    book.registerSupplier({
      id: "supplier_market",
      identification: "900123456",
      name: "Market",
      issuesEInvoices: false,
      leadTimeDays: 2,
    });
    book.openOrder({
      id: ORDER_ID,
      supplierId: "supplier_market",
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
    await subject.purchasing.save(book);
    await subject.purchasing.confirm({
      tenantId: TENANT_A,
      receiptId: "receipt_partial",
      locationId: LOCATION_ID,
      actorId: ACTOR_ID,
      occurredAt: OCCURRED_AT,
      purchaseOrderId: ORDER_ID,
      lines: [
        {
          ingredientId: TOMATO_ID,
          purchaseQuantity: 4,
          purchaseUnitCost: 4000,
          publishedFactor: 1,
        },
      ],
    });

    expect(await subject.purchasing.load(TENANT_B)).toBeNull();
    expect(await subject.movements(TENANT_B)).toEqual([]);
    expect(await subject.receipts(TENANT_B)).toEqual([]);
    expect(await subject.balance(TENANT_B, LOCATION_ID, TOMATO_ID)).toBe(0);
    expect((await subject.purchasing.load(TENANT_A))?.orders[0]?.status).toBe(
      PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED,
    );
    expect(await subject.balance(TENANT_A, LOCATION_ID, TOMATO_ID)).toBe(
      4 * KG_FACTOR,
    );
  });

  it("given an open order and a stored receipt, when the next insert fails, then the receipt, movements, average, and status roll back", async () => {
    const subject = await open();
    const book = Purchasing.open({ tenantId: TENANT_A });
    book.registerSupplier({
      id: "supplier_market",
      identification: "900123456",
      name: "Market",
      issuesEInvoices: false,
      leadTimeDays: 2,
    });
    book.openOrder({
      id: ORDER_ID,
      supplierId: "supplier_market",
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
    await subject.purchasing.save(book);
    await subject.purchasing.confirm({
      tenantId: TENANT_A,
      receiptId: "receipt_partial",
      locationId: LOCATION_ID,
      actorId: ACTOR_ID,
      occurredAt: OCCURRED_AT,
      purchaseOrderId: ORDER_ID,
      lines: [
        {
          ingredientId: TOMATO_ID,
          purchaseQuantity: 4,
          purchaseUnitCost: 4000,
          publishedFactor: 1,
        },
      ],
    });
    const balance = await subject.balance(TENANT_A, LOCATION_ID, TOMATO_ID);
    const average = await subject.averageCost(TENANT_A, LOCATION_ID, TOMATO_ID);
    const movements = await subject.movements(TENANT_A);
    const receipts = await subject.receipts(TENANT_A);

    expect(balance).toBe(4 * KG_FACTOR);
    subject.failOnInsert(1);

    await expect(
      subject.purchasing.confirm({
        tenantId: TENANT_A,
        receiptId: "receipt_failed",
        locationId: LOCATION_ID,
        actorId: ACTOR_ID,
        occurredAt: OCCURRED_AT,
        purchaseOrderId: ORDER_ID,
        lines: [
          {
            ingredientId: TOMATO_ID,
            purchaseQuantity: 3,
            purchaseUnitCost: 4000,
            publishedFactor: 1,
          },
        ],
      }),
    ).rejects.toThrow();

    const stored = await subject.purchasing.load(TENANT_A);

    expect(stored?.orders[0]?.status).toBe(
      PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED,
    );
    expect(stored?.orders[0]?.lines[0]?.receivedQuantity).toBe(4);
    expect(await subject.balance(TENANT_A, LOCATION_ID, TOMATO_ID)).toBe(
      balance,
    );
    expect(await subject.averageCost(TENANT_A, LOCATION_ID, TOMATO_ID)).toBe(
      average,
    );
    expect(await subject.movements(TENANT_A)).toEqual(movements);
    expect(await subject.receipts(TENANT_A)).toEqual(receipts);
    expect(await subject.outboxCount(TENANT_A)).toBe(0);
  });
}
