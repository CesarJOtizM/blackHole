import { expect, it } from "vitest";

import { InMemoryPurchasingRepository } from "#adapters/memory/in-memory-purchasing-repository.js";
import { InMemoryShortageRepository } from "#adapters/memory/in-memory-shortage-repository.js";
import { InMemoryStockLedgerRepository } from "#adapters/memory/in-memory-stock-ledger-repository.js";
import { CancelPurchaseOrder } from "#application/cancel-purchase-order/cancel-purchase-order.js";
import { CreatePurchaseOrder } from "#application/create-purchase-order/create-purchase-order.js";
import { CreateSupplier } from "#application/create-supplier/create-supplier.js";
import { EvaluateStockLevels } from "#application/evaluate-stock-levels/evaluate-stock-levels.js";
import {
  INVENTORY_LOCATION_KIND,
  type InventoryLocation,
  InventoryLocationDirectory,
} from "#application/ports/inventory-location-directory.js";
import { PublishedPurchaseFactor } from "#application/ports/published-purchase-factor.js";
import { ShortageAudit } from "#application/ports/shortage-audit.js";
import type { AppendStock } from "#application/ports/stock-ledger-repository.js";
import {
  CONSUMPTION_ROLE,
  type LedgerLine,
} from "#application/ports/stock-ledger-repository.js";
import {
  ReceivePurchase,
  UnknownInventoryLocation,
} from "#application/receive-purchase/receive-purchase.js";
import {
  OverReceipt,
  PURCHASE_ORDER_STATUS,
  PurchaseOrderClosed,
} from "#domain/purchasing.js";
import { QUANTITY_SCALE } from "#domain/recipe-catalog.js";
import { LEVEL_SEVERITY, SHORTAGE_KIND } from "#domain/shortage-alert.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const LOCATION_ID = "location_point_of_sale";
const WAREHOUSE_ID = "location_warehouse";
const TOMATO_ID = "ingredient_tomato";
const SUPPLIER_ID = "supplier_market";
const ORDER_ID = "purchase_order_tomato";
const LINE_ID = "line_tomato";
const ACTOR_ID = "user_kitchen_chief";
const OCCURRED_AT = "2026-06-01T12:00:00.000Z";
const KG_FACTOR = 1000 * QUANTITY_SCALE;
const GRAM_FACTOR = QUANTITY_SCALE;

const grams = (quantity: number): number => quantity * QUANTITY_SCALE;

class GuardedLedger extends InMemoryStockLedgerRepository {
  override async append(_input: AppendStock): Promise<void> {
    throw new Error("ReceivePurchase wrote through append.");
  }
}

class MemoryLocations extends InventoryLocationDirectory {
  private readonly locations = new Map<string, InventoryLocation>();

  remember(
    tenantId: string,
    requestedId: string,
    location: InventoryLocation,
  ): void {
    this.locations.set(`${tenantId}\u0000${requestedId}`, location);
  }

  override async find(
    tenantId: string,
    locationId: string,
  ): Promise<InventoryLocation | null> {
    return this.locations.get(`${tenantId}\u0000${locationId}`) ?? null;
  }
}

class MemoryFactors extends PublishedPurchaseFactor {
  private readonly factors = new Map<string, number>();

  remember(tenantId: string, ingredientId: string, factor: number): void {
    this.factors.set(`${tenantId}\u0000${ingredientId}`, factor);
  }

  override async factorOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<number> {
    const factor = this.factors.get(`${tenantId}\u0000${ingredientId}`);

    if (factor === undefined) {
      throw new Error("That ingredient has no published purchase factor.");
    }

    return factor;
  }
}

const harness = (
  ledger: InMemoryStockLedgerRepository = new GuardedLedger(),
) => {
  const purchasing = new InMemoryPurchasingRepository(ledger);
  const locations = new MemoryLocations();
  const factors = new MemoryFactors();
  const receive = new ReceivePurchase(purchasing, locations, factors);

  return { purchasing, locations, factors, receive, ledger };
};

const rememberPoint = (
  locations: MemoryLocations,
  requestedId = LOCATION_ID,
): void => {
  locations.remember(TENANT_ID, requestedId, {
    id: LOCATION_ID,
    kind: INVENTORY_LOCATION_KIND.POINT,
  });
};

const rememberWarehouse = (locations: MemoryLocations): void => {
  locations.remember(TENANT_ID, WAREHOUSE_ID, {
    id: WAREHOUSE_ID,
    kind: INVENTORY_LOCATION_KIND.WAREHOUSE,
  });
};

const saleLine = (
  id: string,
  quantity: number,
  type: LedgerLine["type"],
  role: LedgerLine["role"],
): LedgerLine => ({
  id,
  tenantId: TENANT_ID,
  venueId: "venue_kitchen",
  locationId: LOCATION_ID,
  ingredientId: TOMATO_ID,
  quantity,
  unitCost: 12,
  type,
  reference: "sale_line",
  occurredAt: OCCURRED_AT,
  orderLineId: "line_sale",
  role,
  recipeVersion: 1,
  reason: null,
  actorId: null,
});

const openOrder = async (
  purchasing: InMemoryPurchasingRepository,
  locationId: string,
  purchaseQuantity = 10,
  factor = KG_FACTOR,
) => {
  await new CreateSupplier(purchasing).execute({
    tenantId: TENANT_ID,
    id: SUPPLIER_ID,
    identification: "900123456",
    name: "Market",
    issuesEInvoices: false,
    leadTimeDays: 2,
  });

  return new CreatePurchaseOrder(purchasing).execute({
    tenantId: TENANT_ID,
    id: ORDER_ID,
    supplierId: SUPPLIER_ID,
    locationId,
    lines: [
      {
        id: LINE_ID,
        ingredientId: TOMATO_ID,
        purchaseQuantity,
        factor,
      },
    ],
  });
};

it("given no purchase order, when 5 kg at 4000 COP/kg is received, then 5000 g at 4 COP/g is recorded", async () => {
  const { purchasing, locations, factors, receive, ledger } = harness();
  rememberPoint(locations, "location_requested");
  factors.remember(TENANT_ID, TOMATO_ID, KG_FACTOR);

  const receipt = await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_direct",
    locationId: "location_requested",
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 5,
        purchaseUnitCost: 4000,
      },
    ],
  });

  expect(receipt).toEqual({
    receiptId: "receipt_direct",
    tenantId: TENANT_ID,
    locationId: LOCATION_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: null,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 5,
        purchaseUnitCost: 4000,
        factor: KG_FACTOR,
        quantity: 5000 * QUANTITY_SCALE,
        unitCost: 4,
      },
    ],
  });
  expect(purchasing.purchaseMovements(TENANT_ID)).toEqual([
    {
      id: "movement_receipt_direct_ingredient_tomato",
      tenantId: TENANT_ID,
      locationId: LOCATION_ID,
      ingredientId: TOMATO_ID,
      quantity: 5000 * QUANTITY_SCALE,
      unitCost: 4,
      type: MOVEMENT_TYPE.PURCHASE,
      reference: "receipt_direct",
      occurredAt: OCCURRED_AT,
      actorId: ACTOR_ID,
      orderLineId: null,
      role: null,
      recipeVersion: null,
    },
  ]);
  expect(purchasing.afterSales(TENANT_ID)).toEqual([]);
  expect(purchasing.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(4);
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    5000 * QUANTITY_SCALE,
  );
  expect(await ledger.queued(TENANT_ID)).toEqual([]);
});

it("given 1000 g at 10 COP/g, when 1000 g arrive at 14 COP/g, then the average is 12", async () => {
  const { purchasing, locations, factors, receive } = harness();
  rememberPoint(locations);
  factors.remember(TENANT_ID, TOMATO_ID, GRAM_FACTOR);
  await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_10",
    locationId: LOCATION_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 1000,
        purchaseUnitCost: 10,
      },
    ],
  });

  await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_14",
    locationId: LOCATION_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 1000,
        purchaseUnitCost: 14,
      },
    ],
  });

  expect(purchasing.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    nextAverageCost({
      onHand: grams(1000),
      averageCost: 10,
      receivedQuantity: grams(1000),
      receiptCost: 14,
    }),
  );
});

it("given on-hand already on the ledger, when a receipt is confirmed, then the average uses that on-hand", async () => {
  const ledger = new InMemoryStockLedgerRepository();
  const { purchasing, locations, factors, receive } = harness(ledger);
  rememberPoint(locations);
  factors.remember(TENANT_ID, TOMATO_ID, GRAM_FACTOR);
  await ledger.append({
    movements: [
      saleLine(
        "movement_return",
        grams(1000),
        MOVEMENT_TYPE.SALE_RETURN,
        CONSUMPTION_ROLE.REVERSAL,
      ),
    ],
    alerts: [],
  });
  const queued = await ledger.queued(TENANT_ID);

  await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_onto_stock",
    locationId: LOCATION_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 1000,
        purchaseUnitCost: 20,
      },
    ],
  });

  expect(purchasing.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    nextAverageCost({
      onHand: grams(1000),
      averageCost: 0,
      receivedQuantity: grams(1000),
      receiptCost: 20,
    }),
  );
  expect(await ledger.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    grams(2000),
  );
  expect(await ledger.queued(TENANT_ID)).toEqual(queued);
  expect(purchasing.afterSales(TENANT_ID)).toEqual([]);
});

it("given on-hand below zero, when a receipt is confirmed, then the average is the receipt cost", async () => {
  const ledger = new InMemoryStockLedgerRepository();
  const { purchasing, locations, factors, receive } = harness(ledger);
  rememberPoint(locations);
  factors.remember(TENANT_ID, TOMATO_ID, GRAM_FACTOR);
  await ledger.append({
    movements: [
      saleLine(
        "movement_consumption",
        grams(-200),
        MOVEMENT_TYPE.SALE_CONSUMPTION,
        CONSUMPTION_ROLE.CONSUMPTION,
      ),
    ],
    alerts: [],
  });

  await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_after_negative",
    locationId: LOCATION_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 1000,
        purchaseUnitCost: 20,
      },
    ],
  });

  expect(purchasing.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(20);
  expect(purchasing.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(
    nextAverageCost({
      onHand: grams(-200),
      averageCost: 0,
      receivedQuantity: grams(1000),
      receiptCost: 20,
    }),
  );
});

it("given an average of 12 COP/g, when waste is appended, then the purchase average stays 12", async () => {
  const ledger = new InMemoryStockLedgerRepository();
  const { purchasing, locations, factors, receive } = harness(ledger);
  rememberPoint(locations);
  factors.remember(TENANT_ID, TOMATO_ID, GRAM_FACTOR);
  await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_10",
    locationId: LOCATION_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 1000,
        purchaseUnitCost: 10,
      },
    ],
  });
  await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_14",
    locationId: LOCATION_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 1000,
        purchaseUnitCost: 14,
      },
    ],
  });

  await ledger.append({
    movements: [
      saleLine(
        "movement_waste",
        grams(-200),
        MOVEMENT_TYPE.WASTE,
        CONSUMPTION_ROLE.REVERSAL,
      ),
    ],
    alerts: [],
  });

  expect(purchasing.averageCost(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(12);
  expect(purchasing.afterSales(TENANT_ID)).toEqual([]);
  expect(await ledger.queued(TENANT_ID)).toHaveLength(1);
  expect((await ledger.queued(TENANT_ID))[0]?.event.movementType).toBe(
    MOVEMENT_TYPE.WASTE,
  );
});

it("given an order for 10, when 6 and then 4 are received, then it is partial and then received", async () => {
  const { purchasing, locations, factors, receive } = harness();
  rememberWarehouse(locations);
  factors.remember(TENANT_ID, TOMATO_ID, KG_FACTOR);
  await openOrder(purchasing, WAREHOUSE_ID);

  await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_six",
    locationId: WAREHOUSE_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: ORDER_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 6,
        purchaseUnitCost: 4000,
      },
    ],
  });

  const partial = (await purchasing.load(TENANT_ID))?.orders.find(
    (order) => order.id === ORDER_ID,
  );

  expect(partial?.status).toBe(PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED);
  expect(partial?.lines[0]?.receivedQuantity).toBe(6);
  expect(
    (partial?.lines[0]?.purchaseQuantity ?? 0) -
      (partial?.lines[0]?.receivedQuantity ?? 0),
  ).toBe(4);

  await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_rest",
    locationId: WAREHOUSE_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: ORDER_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 4,
        purchaseUnitCost: 4000,
      },
    ],
  });

  const received = (await purchasing.load(TENANT_ID))?.orders.find(
    (order) => order.id === ORDER_ID,
  );
  const receiveAgain = receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_extra",
    locationId: WAREHOUSE_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: ORDER_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 1,
        purchaseUnitCost: 4000,
      },
    ],
  });

  expect(received?.status).toBe(PURCHASE_ORDER_STATUS.RECEIVED);
  expect(received?.lines[0]?.receivedQuantity).toBe(10);
  await expect(receiveAgain).rejects.toThrow(PurchaseOrderClosed);
  expect(received?.status).toBe(PURCHASE_ORDER_STATUS.RECEIVED);
  expect(received?.lines[0]?.receivedQuantity).toBe(10);
});

it("given a quantity above the remainder, when a receipt is confirmed, then it is rejected", async () => {
  const { purchasing, locations, factors, receive } = harness();
  rememberWarehouse(locations);
  factors.remember(TENANT_ID, TOMATO_ID, KG_FACTOR);
  await openOrder(purchasing, WAREHOUSE_ID);
  const before = (await purchasing.load(TENANT_ID))?.orders.find(
    (order) => order.id === ORDER_ID,
  );
  const linesBefore = before?.lines.map((line) => ({ ...line }));

  const receiveTooMuch = receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_over",
    locationId: WAREHOUSE_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: ORDER_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 11,
        purchaseUnitCost: 4000,
      },
    ],
  });

  await expect(receiveTooMuch).rejects.toThrow(OverReceipt);
  const stored = (await purchasing.load(TENANT_ID))?.orders.find(
    (order) => order.id === ORDER_ID,
  );
  expect(stored?.status).toBe(PURCHASE_ORDER_STATUS.OPEN);
  expect(stored?.lines).toEqual(linesBefore);
  expect(purchasing.purchaseMovements(TENANT_ID)).toEqual([]);
  expect(purchasing.afterSales(TENANT_ID)).toEqual([]);
});

it("given a cancelled order, when a receipt is confirmed, then it is rejected", async () => {
  const { purchasing, locations, factors, receive, ledger } = harness();
  rememberWarehouse(locations);
  factors.remember(TENANT_ID, TOMATO_ID, KG_FACTOR);
  await openOrder(purchasing, WAREHOUSE_ID);
  await new CancelPurchaseOrder(purchasing, ledger).execute({
    tenantId: TENANT_ID,
    purchaseOrderId: ORDER_ID,
  });

  const receiveClosed = receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_closed",
    locationId: WAREHOUSE_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: ORDER_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 4,
        purchaseUnitCost: 4000,
      },
    ],
  });

  await expect(receiveClosed).rejects.toThrow(PurchaseOrderClosed);
  const stored = (await purchasing.load(TENANT_ID))?.orders.find(
    (order) => order.id === ORDER_ID,
  );
  expect(stored?.status).toBe(PURCHASE_ORDER_STATUS.CANCELLED);
  expect(stored?.lines[0]?.receivedQuantity).toBe(0);
  expect(purchasing.purchaseMovements(TENANT_ID)).toEqual([]);
});

it("given a receipt already confirmed, when the same receiptId is submitted, then nothing changes", async () => {
  const { purchasing, locations, factors, receive } = harness();
  rememberWarehouse(locations);
  factors.remember(TENANT_ID, TOMATO_ID, KG_FACTOR);
  await openOrder(purchasing, WAREHOUSE_ID);
  const first = await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_six",
    locationId: WAREHOUSE_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: ORDER_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 6,
        purchaseUnitCost: 4000,
      },
    ],
  });
  const movements = purchasing.purchaseMovements(TENANT_ID);

  const second = await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_six",
    locationId: WAREHOUSE_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: ORDER_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 9,
        purchaseUnitCost: 100,
      },
    ],
  });

  const stored = (await purchasing.load(TENANT_ID))?.orders.find(
    (order) => order.id === ORDER_ID,
  );
  expect(second).toEqual(first);
  expect(stored?.status).toBe(PURCHASE_ORDER_STATUS.PARTIALLY_RECEIVED);
  expect(stored?.lines[0]?.receivedQuantity).toBe(6);
  expect(purchasing.purchaseMovements(TENANT_ID)).toEqual(movements);
  expect(purchasing.averageCost(TENANT_ID, WAREHOUSE_ID, TOMATO_ID)).toBe(4);
});

it("given an unknown location, when a receipt is submitted, then confirm is not called", async () => {
  let confirmations = 0;
  const purchasing = new (class extends InMemoryPurchasingRepository {
    override async confirm(
      input: Parameters<InMemoryPurchasingRepository["confirm"]>[0],
    ) {
      confirmations += 1;
      return super.confirm(input);
    }
  })();
  const locations = new MemoryLocations();
  const factors = new MemoryFactors();
  factors.remember(TENANT_ID, TOMATO_ID, KG_FACTOR);
  const receive = new ReceivePurchase(purchasing, locations, factors);

  const missing = receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_missing_location",
    locationId: "location_missing",
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 5,
        purchaseUnitCost: 4000,
      },
    ],
  });

  await expect(missing).rejects.toThrow(UnknownInventoryLocation);
  expect(confirmations).toBe(0);
  expect(purchasing.purchaseMovements(TENANT_ID)).toEqual([]);
});

it("given an order line with a frozen factor, when the published factor changes, then the receipt keeps the order factor", async () => {
  const { purchasing, locations, factors, receive } = harness();
  rememberWarehouse(locations);
  factors.remember(TENANT_ID, TOMATO_ID, 500 * QUANTITY_SCALE);
  await openOrder(purchasing, WAREHOUSE_ID, 10, KG_FACTOR);

  const receipt = await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_frozen",
    locationId: WAREHOUSE_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    purchaseOrderId: ORDER_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 5,
        purchaseUnitCost: 4000,
      },
    ],
  });

  expect(receipt.lines[0]).toEqual({
    ingredientId: TOMATO_ID,
    purchaseQuantity: 5,
    purchaseUnitCost: 4000,
    factor: KG_FACTOR,
    quantity: 5000 * QUANTITY_SCALE,
    unitCost: 4,
  });
  expect(
    (await purchasing.load(TENANT_ID))?.orders.find(
      (order) => order.id === ORDER_ID,
    )?.lines[0]?.factor,
  ).toBe(KG_FACTOR);
});

const BRAND_ID = "organization_brand_1";
const VENUE_ID = "organization_venue_1";

class SilentShortageAudit extends ShortageAudit {
  override async record(): Promise<void> {}
}

class ThrowingShortage extends InMemoryShortageRepository {
  override async saveLevelAlert(): Promise<void> {
    throw new Error("alert insert failed");
  }
}

const levelHarness = (shortages: InMemoryShortageRepository) => {
  const ledger = new InMemoryStockLedgerRepository();
  const purchasing = new InMemoryPurchasingRepository(ledger);
  const locations = new MemoryLocations();
  const factors = new MemoryFactors();
  const receive = new ReceivePurchase(
    purchasing,
    locations,
    factors,
    ledger,
    new EvaluateStockLevels(shortages, new SilentShortageAudit()),
  );

  return { purchasing, locations, factors, receive, ledger };
};

it("given alerts on and a reorder point above the receipt, when the purchase is received, then one yellow alert opens in that ledger transaction", async () => {
  const shortages = new InMemoryShortageRepository();
  await shortages.saveBrandLevel({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    ingredientId: TOMATO_ID,
    maximum: grams(20_000),
    reorderPoint: grams(6_000),
    minimum: grams(1_000),
  });
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const { locations, factors, receive } = levelHarness(shortages);
  rememberPoint(locations);
  factors.remember(TENANT_ID, TOMATO_ID, KG_FACTOR);

  const receipt = await receive.execute({
    tenantId: TENANT_ID,
    receiptId: "receipt_shortage",
    locationId: LOCATION_ID,
    actorId: ACTOR_ID,
    occurredAt: OCCURRED_AT,
    brandId: BRAND_ID,
    venueId: VENUE_ID,
    lines: [
      {
        ingredientId: TOMATO_ID,
        purchaseQuantity: 5,
        purchaseUnitCost: 4000,
      },
    ],
  });

  expect(receipt.lines[0]?.quantity).toBe(5_000 * QUANTITY_SCALE);
  const open = await shortages.listOpenShortages(TENANT_ID, VENUE_ID);
  expect(open).toHaveLength(1);
  expect(open[0]).toMatchObject({
    kind: SHORTAGE_KIND.LEVEL,
    alert: {
      ingredientId: TOMATO_ID,
      severity: LEVEL_SEVERITY.YELLOW,
      soldOut: false,
    },
  });
});

it("given alerts on, when saving the level alert fails, then the purchase movement rolls back", async () => {
  const shortages = new ThrowingShortage();
  await shortages.saveBrandLevel({
    tenantId: TENANT_ID,
    brandId: BRAND_ID,
    ingredientId: TOMATO_ID,
    maximum: grams(20_000),
    reorderPoint: grams(6_000),
    minimum: grams(1_000),
  });
  await shortages.saveAlertsEnabled(TENANT_ID, VENUE_ID, true);
  const { locations, factors, receive, ledger, purchasing } =
    levelHarness(shortages);
  rememberPoint(locations);
  factors.remember(TENANT_ID, TOMATO_ID, KG_FACTOR);

  await expect(
    receive.execute({
      tenantId: TENANT_ID,
      receiptId: "receipt_shortage_rollback",
      locationId: LOCATION_ID,
      actorId: ACTOR_ID,
      occurredAt: OCCURRED_AT,
      brandId: BRAND_ID,
      venueId: VENUE_ID,
      lines: [
        {
          ingredientId: TOMATO_ID,
          purchaseQuantity: 5,
          purchaseUnitCost: 4000,
        },
      ],
    }),
  ).rejects.toThrow("alert insert failed");

  expect(await ledger.balance(TENANT_ID, LOCATION_ID, TOMATO_ID)).toBe(0);
  expect(purchasing.purchaseMovements(TENANT_ID)).toEqual([]);
  expect(await shortages.listOpenShortages(TENANT_ID, VENUE_ID)).toEqual([]);
});
