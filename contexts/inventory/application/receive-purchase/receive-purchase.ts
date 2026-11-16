import type { EvaluateStockLevels } from "#application/evaluate-stock-levels/evaluate-stock-levels.js";
import type { InventoryLocationDirectory } from "#application/ports/inventory-location-directory.js";
import type { PublishedPurchaseFactor } from "#application/ports/published-purchase-factor.js";
import type {
  ConfirmPurchaseLine,
  PurchaseReceipt,
  PurchasingRepository,
} from "#application/ports/purchasing-repository.js";
import type { StockLedgerRepository } from "#application/ports/stock-ledger-repository.js";

export class UnknownInventoryLocation extends Error {
  constructor() {
    super("The inventory location is not a point of sale or a warehouse.");
    this.name = "UnknownInventoryLocation";
  }
}

export interface ReceivePurchaseLine {
  ingredientId: string;
  purchaseQuantity: number;
  purchaseUnitCost: number;
}

export interface ReceivePurchaseInput {
  tenantId: string;
  receiptId: string;
  locationId: string;
  actorId: string;
  occurredAt: string;
  purchaseOrderId?: string;
  brandId?: string;
  venueId?: string;
  lines: readonly ReceivePurchaseLine[];
}

export type { PurchaseReceipt } from "#application/ports/purchasing-repository.js";

export class ReceivePurchase {
  constructor(
    private readonly purchasing: PurchasingRepository,
    private readonly locations: InventoryLocationDirectory,
    private readonly factors: PublishedPurchaseFactor,
    private readonly ledger: StockLedgerRepository | null = null,
    private readonly levels: EvaluateStockLevels | null = null,
  ) {}

  async execute(input: ReceivePurchaseInput): Promise<PurchaseReceipt> {
    const location = await this.locations.find(
      input.tenantId,
      input.locationId,
    );

    if (!location) {
      throw new UnknownInventoryLocation();
    }

    const lines: ConfirmPurchaseLine[] = await Promise.all(
      input.lines.map(async (line) => ({
        ingredientId: line.ingredientId,
        purchaseQuantity: line.purchaseQuantity,
        purchaseUnitCost: line.purchaseUnitCost,
        publishedFactor: await this.factors.factorOf(
          input.tenantId,
          line.ingredientId,
        ),
      })),
    );

    const confirm = () =>
      this.purchasing.confirm({
        tenantId: input.tenantId,
        receiptId: input.receiptId,
        locationId: location.id,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
        purchaseOrderId: input.purchaseOrderId ?? null,
        lines,
      });

    if (!this.ledger) {
      return confirm();
    }

    return this.ledger.inTransaction(async (tx) => {
      const receipt = await confirm();
      const brandId = input.brandId;
      const venueId = input.venueId;

      if (!this.levels || !brandId || !venueId) {
        return receipt;
      }

      for (const line of receipt.lines) {
        await this.levels.evaluate(tx, {
          tenantId: input.tenantId,
          brandId,
          venueId,
          locationId: receipt.locationId,
          ingredientId: line.ingredientId,
          occurredAt: input.occurredAt,
        });
      }

      return receipt;
    });
  }
}
