import type { PurchasingRepository } from "#application/ports/purchasing-repository.js";
import type { StockLedgerRepository } from "#application/ports/stock-ledger-repository.js";
import type { PurchaseOrder } from "#domain/purchasing.js";

export class UnknownPurchaseOrder extends Error {
  constructor() {
    super("The purchase order is not in this company.");
    this.name = "UnknownPurchaseOrder";
  }
}

export class PurchaseCancelChangedStock extends Error {
  constructor() {
    super("Cancelling a purchase order must not change stock.");
    this.name = "PurchaseCancelChangedStock";
  }
}

export interface CancelPurchaseOrderInput {
  tenantId: string;
  purchaseOrderId: string;
}

const balancesOf = (
  ledger: StockLedgerRepository,
  tenantId: string,
  order: PurchaseOrder,
): Promise<readonly number[]> =>
  Promise.all(
    order.lines.map((line) =>
      ledger.balance(tenantId, order.locationId, line.ingredientId),
    ),
  );

const sameBalances = (
  before: readonly number[],
  after: readonly number[],
): boolean =>
  before.length === after.length &&
  before.every((balance, index) => balance === after[index]);

export class CancelPurchaseOrder {
  constructor(
    private readonly purchasing: PurchasingRepository,
    private readonly ledger: StockLedgerRepository,
  ) {}

  async execute(input: CancelPurchaseOrderInput): Promise<PurchaseOrder> {
    const book = await this.purchasing.load(input.tenantId);
    const order = book?.orders.find(
      (item) => item.id === input.purchaseOrderId,
    );

    if (!book || !order) {
      throw new UnknownPurchaseOrder();
    }

    const before = await balancesOf(this.ledger, input.tenantId, order);
    order.cancel();
    await this.purchasing.save(book);
    const after = await balancesOf(this.ledger, input.tenantId, order);

    if (!sameBalances(before, after)) {
      throw new PurchaseCancelChangedStock();
    }

    return order;
  }
}
