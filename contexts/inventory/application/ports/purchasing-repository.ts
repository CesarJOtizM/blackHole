import type { Purchasing } from "#domain/purchasing.js";

export interface PurchaseReceiptLine {
  ingredientId: string;
  purchaseQuantity: number;
  purchaseUnitCost: number;
  factor: number;
  quantity: number;
  unitCost: number;
}

export interface PurchaseReceipt {
  receiptId: string;
  tenantId: string;
  locationId: string;
  actorId: string;
  occurredAt: string;
  purchaseOrderId: string | null;
  lines: readonly PurchaseReceiptLine[];
}

export interface ConfirmPurchaseLine {
  ingredientId: string;
  purchaseQuantity: number;
  purchaseUnitCost: number;
  publishedFactor: number;
}

export interface ConfirmPurchase {
  tenantId: string;
  receiptId: string;
  locationId: string;
  actorId: string;
  occurredAt: string;
  purchaseOrderId: string | null;
  lines: readonly ConfirmPurchaseLine[];
}

export abstract class PurchasingRepository {
  abstract load(tenantId: string): Promise<Purchasing | null>;

  abstract save(purchasing: Purchasing): Promise<void>;

  abstract confirm(input: ConfirmPurchase): Promise<PurchaseReceipt>;
}
