import type { PostedPurchase } from "#adapters/memory/in-memory-stock-ledger-repository.js";
import { InMemoryStockLedgerRepository } from "#adapters/memory/in-memory-stock-ledger-repository.js";
import {
  type ConfirmPurchase,
  type PurchaseReceipt,
  type PurchaseReceiptLine,
  PurchasingRepository,
} from "#application/ports/purchasing-repository.js";
import type { StockLedgerRepository } from "#application/ports/stock-ledger-repository.js";
import {
  InvalidPurchase,
  PURCHASE_ORDER_STATUS,
  type PurchaseOrder,
  Purchasing,
  toBaseReceipt,
} from "#domain/purchasing.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

export type RecordedPurchaseMovement = PostedPurchase;

export interface PurchaseOutboxRow {
  lane: "after_sales";
  tenantId: string;
  receiptId: string;
}

const receiptKey = (tenantId: string, receiptId: string): string =>
  `${tenantId}\u0000${receiptId}`;

const balanceKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}\u0000${locationId}\u0000${ingredientId}`;

const copyReceipt = (receipt: PurchaseReceipt): PurchaseReceipt => ({
  ...receipt,
  lines: receipt.lines.map((line) => ({ ...line })),
});

const copyMovement = (
  movement: RecordedPurchaseMovement,
): RecordedPurchaseMovement => ({ ...movement });

export class InMemoryPurchasingRepository extends PurchasingRepository {
  private readonly byTenant = new Map<string, Purchasing>();
  private readonly receiptByKey = new Map<string, PurchaseReceipt>();
  private readonly movements: RecordedPurchaseMovement[] = [];
  private readonly purchaseOnHand = new Map<string, number>();
  private readonly averages = new Map<string, number>();
  private readonly outbox: PurchaseOutboxRow[] = [];
  private failAt: number | null = null;

  constructor(private readonly ledger: StockLedgerRepository | null = null) {
    super();
  }

  failOnInsert(ordinal: number): void {
    this.failAt = ordinal;
  }

  override async load(tenantId: string): Promise<Purchasing | null> {
    return this.byTenant.get(tenantId) ?? null;
  }

  override async save(purchasing: Purchasing): Promise<void> {
    this.byTenant.set(purchasing.tenantId, purchasing);
  }

  purchaseMovements(tenantId: string): readonly RecordedPurchaseMovement[] {
    const stock = this.stock();

    if (stock) {
      return stock.postedPurchases(tenantId);
    }

    return this.movements
      .filter((movement) => movement.tenantId === tenantId)
      .map(copyMovement);
  }

  storedReceipts(tenantId: string): readonly PurchaseReceipt[] {
    return [...this.receiptByKey.values()]
      .filter((receipt) => receipt.tenantId === tenantId)
      .map(copyReceipt);
  }

  averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): number {
    const stock = this.stock();

    if (stock) {
      return stock.purchaseAverage(tenantId, locationId, ingredientId);
    }

    return (
      this.averages.get(balanceKey(tenantId, locationId, ingredientId)) ?? 0
    );
  }

  afterSales(tenantId: string): readonly PurchaseOutboxRow[] {
    return this.outbox
      .filter((row) => row.tenantId === tenantId)
      .map((row) => ({ ...row }));
  }

  override async confirm(input: ConfirmPurchase): Promise<PurchaseReceipt> {
    const existing = this.receiptByKey.get(
      receiptKey(input.tenantId, input.receiptId),
    );

    if (existing) {
      return copyReceipt(existing);
    }

    const failAt = this.failAt;
    this.failAt = null;
    const current = this.byTenant.get(input.tenantId) ?? null;
    const snapshot = current === null ? null : clonePurchasing(current);

    try {
      const lines =
        input.purchaseOrderId === null
          ? this.directLines(input)
          : this.orderLines(input);

      return await this.record(input, lines, failAt);
    } catch (error) {
      if (snapshot) {
        this.byTenant.set(input.tenantId, snapshot);
      }

      throw error;
    }
  }

  private directLines(input: ConfirmPurchase): PurchaseReceiptLine[] {
    if (input.receiptId.length === 0 || input.lines.length === 0) {
      throw new InvalidPurchase();
    }

    return input.lines.map((line) => {
      const converted = toBaseReceipt({
        purchaseQuantity: line.purchaseQuantity,
        purchaseUnitCost: line.purchaseUnitCost,
        factor: line.publishedFactor,
      });

      return {
        ingredientId: line.ingredientId,
        purchaseQuantity: converted.purchaseQuantity,
        purchaseUnitCost: converted.purchaseUnitCost,
        factor: converted.factor,
        quantity: converted.quantity,
        unitCost: converted.unitCost,
      };
    });
  }

  private orderLines(input: ConfirmPurchase): PurchaseReceiptLine[] {
    const order = this.order(input.tenantId, input.purchaseOrderId);

    if (order.locationId !== input.locationId) {
      throw new InvalidPurchase();
    }

    const received = order.receive({
      receiptId: input.receiptId,
      lines: input.lines.map((line) => ({
        lineId: this.orderLineId(order, line.ingredientId),
        purchaseQuantity: line.purchaseQuantity,
        purchaseUnitCost: line.purchaseUnitCost,
      })),
    });

    return received.map((line) => ({
      ingredientId: line.ingredientId,
      purchaseQuantity: line.purchaseQuantity,
      purchaseUnitCost: line.purchaseUnitCost,
      factor: line.factor,
      quantity: line.quantity,
      unitCost: line.unitCost,
    }));
  }

  private async record(
    input: ConfirmPurchase,
    lines: readonly PurchaseReceiptLine[],
    failAt: number | null,
  ): Promise<PurchaseReceipt> {
    const stock = this.stock();
    const running = new Map<string, number>();
    const pendingAverage = new Map<string, number>();
    const postings: {
      movement: RecordedPurchaseMovement;
      averageCost: number;
    }[] = [];

    for (const line of lines) {
      const key = balanceKey(
        input.tenantId,
        input.locationId,
        line.ingredientId,
      );
      const posted = stock
        ? await stock.balance(
            input.tenantId,
            input.locationId,
            line.ingredientId,
          )
        : (this.purchaseOnHand.get(key) ?? 0);
      const average = pendingAverage.has(key)
        ? (pendingAverage.get(key) ?? 0)
        : stock
          ? stock.purchaseAverage(
              input.tenantId,
              input.locationId,
              line.ingredientId,
            )
          : (this.averages.get(key) ?? 0);
      const next = nextAverageCost({
        onHand: posted + (running.get(key) ?? 0),
        averageCost: average,
        receivedQuantity: line.quantity,
        receiptCost: line.unitCost,
      });
      pendingAverage.set(key, next);
      running.set(key, (running.get(key) ?? 0) + line.quantity);
      postings.push({
        movement: {
          id: `movement_${input.receiptId}_${line.ingredientId}`,
          tenantId: input.tenantId,
          locationId: input.locationId,
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          type: MOVEMENT_TYPE.PURCHASE,
          reference: input.receiptId,
          occurredAt: input.occurredAt,
          actorId: input.actorId,
          orderLineId: null,
          role: null,
          recipeVersion: null,
        },
        averageCost: next,
      });
    }

    if (stock) {
      stock.postPurchases(postings, failAt);
    } else {
      this.postLocally(postings, failAt);
    }

    const receipt: PurchaseReceipt = {
      receiptId: input.receiptId,
      tenantId: input.tenantId,
      locationId: input.locationId,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      purchaseOrderId: input.purchaseOrderId,
      lines: lines.map((line) => ({ ...line })),
    };
    this.receiptByKey.set(receiptKey(input.tenantId, input.receiptId), receipt);
    return copyReceipt(receipt);
  }

  // A ledger balance already includes posted purchases. This receipt's lines
  // are added once, when postPurchases writes the same movement.
  private postLocally(
    postings: readonly {
      movement: RecordedPurchaseMovement;
      averageCost: number;
    }[],
    failAt: number | null,
  ): void {
    const movements = this.movements.map(copyMovement);
    const onHand = new Map(this.purchaseOnHand);
    const averages = new Map(this.averages);

    try {
      for (const [index, posting] of postings.entries()) {
        if (failAt === index + 1) {
          throw new Error("The purchase receipt insert failed.");
        }

        const key = balanceKey(
          posting.movement.tenantId,
          posting.movement.locationId,
          posting.movement.ingredientId,
        );
        this.movements.push(copyMovement(posting.movement));
        this.purchaseOnHand.set(
          key,
          (this.purchaseOnHand.get(key) ?? 0) + posting.movement.quantity,
        );
        this.averages.set(key, posting.averageCost);
      }
    } catch (error) {
      this.movements.splice(0, this.movements.length, ...movements);
      this.purchaseOnHand.clear();
      this.averages.clear();

      for (const [key, quantity] of onHand) {
        this.purchaseOnHand.set(key, quantity);
      }

      for (const [key, average] of averages) {
        this.averages.set(key, average);
      }

      throw error;
    }
  }

  private stock(): InMemoryStockLedgerRepository | null {
    return this.ledger instanceof InMemoryStockLedgerRepository
      ? this.ledger
      : null;
  }

  private order(
    tenantId: string,
    purchaseOrderId: string | null,
  ): PurchaseOrder {
    if (purchaseOrderId === null) {
      throw new InvalidPurchase();
    }

    const found = this.byTenant
      .get(tenantId)
      ?.orders.find((order) => order.id === purchaseOrderId);

    if (!found) {
      throw new InvalidPurchase();
    }

    return found;
  }

  private orderLineId(order: PurchaseOrder, ingredientId: string): string {
    const found = order.lines.filter(
      (line) => line.ingredientId === ingredientId,
    );
    const line = found[0];

    if (found.length !== 1 || !line) {
      throw new InvalidPurchase();
    }

    return line.id;
  }
}

const clonePurchasing = (source: Purchasing): Purchasing => {
  const copy = Purchasing.open({ tenantId: source.tenantId });

  for (const supplier of source.suppliers) {
    copy.registerSupplier({ ...supplier });
  }

  for (const order of source.orders) {
    const opened = copy.openOrder({
      id: order.id,
      supplierId: order.supplierId,
      locationId: order.locationId,
      lines: order.lines.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        purchaseQuantity: line.purchaseQuantity,
        factor: line.factor,
      })),
    });
    const received = order.lines.filter((line) => line.receivedQuantity > 0);

    if (received.length > 0) {
      opened.receive({
        receiptId: `snapshot_${order.id}`,
        lines: received.map((line) => ({
          lineId: line.id,
          purchaseQuantity: line.receivedQuantity,
          purchaseUnitCost: 0,
        })),
      });
    }

    if (order.status === PURCHASE_ORDER_STATUS.CANCELLED) {
      opened.cancel();
    }
  }

  return copy;
};
