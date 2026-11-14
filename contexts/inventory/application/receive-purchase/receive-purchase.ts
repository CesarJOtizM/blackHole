import type { InventoryLocationDirectory } from "#application/ports/inventory-location-directory.js";
import type { PublishedPurchaseFactor } from "#application/ports/published-purchase-factor.js";
import type {
  ConfirmPurchaseLine,
  PurchaseReceipt,
  PurchasingRepository,
} from "#application/ports/purchasing-repository.js";

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
  lines: readonly ReceivePurchaseLine[];
}

export type { PurchaseReceipt } from "#application/ports/purchasing-repository.js";

export class ReceivePurchase {
  constructor(
    private readonly purchasing: PurchasingRepository,
    private readonly locations: InventoryLocationDirectory,
    private readonly factors: PublishedPurchaseFactor,
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

    return this.purchasing.confirm({
      tenantId: input.tenantId,
      receiptId: input.receiptId,
      locationId: location.id,
      actorId: input.actorId,
      occurredAt: input.occurredAt,
      purchaseOrderId: input.purchaseOrderId ?? null,
      lines,
    });
  }
}
