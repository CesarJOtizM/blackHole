import type { PurchasingRepository } from "#application/ports/purchasing-repository.js";
import { type PurchaseOrder, Purchasing } from "#domain/purchasing.js";

export class UnknownSupplier extends Error {
  constructor() {
    super("A purchase order must target one supplier in this company.");
    this.name = "UnknownSupplier";
  }
}

export interface CreatePurchaseOrderLine {
  id: string;
  ingredientId: string;
  purchaseQuantity: number;
  factor: number;
}

export interface CreatePurchaseOrderInput {
  tenantId: string;
  id: string;
  supplierId: string;
  locationId: string;
  lines: readonly CreatePurchaseOrderLine[];
}

export class CreatePurchaseOrder {
  constructor(private readonly purchasing: PurchasingRepository) {}

  async execute(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
    const book =
      (await this.purchasing.load(input.tenantId)) ??
      Purchasing.open({ tenantId: input.tenantId });

    if (!book.suppliers.some((supplier) => supplier.id === input.supplierId)) {
      throw new UnknownSupplier();
    }

    const order = book.openOrder({
      id: input.id,
      supplierId: input.supplierId,
      locationId: input.locationId,
      lines: input.lines.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        purchaseQuantity: line.purchaseQuantity,
        factor: line.factor,
      })),
    });
    await this.purchasing.save(book);
    return order;
  }
}
