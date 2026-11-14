import type { PurchasingRepository } from "#application/ports/purchasing-repository.js";
import { Purchasing, type Supplier } from "#domain/purchasing.js";

export class DuplicateSupplierIdentification extends Error {
  constructor() {
    super("A supplier identification is already registered for this company.");
    this.name = "DuplicateSupplierIdentification";
  }
}

export interface CreateSupplierInput {
  tenantId: string;
  id: string;
  identification: string;
  name: string;
  issuesEInvoices: boolean;
  leadTimeDays: number;
}

const supplierFrom = (input: CreateSupplierInput): Supplier => ({
  id: input.id,
  identification: input.identification,
  name: input.name,
  issuesEInvoices: input.issuesEInvoices,
  leadTimeDays: input.leadTimeDays,
});

export class CreateSupplier {
  constructor(private readonly purchasing: PurchasingRepository) {}

  async execute(input: CreateSupplierInput): Promise<Supplier> {
    const book =
      (await this.purchasing.load(input.tenantId)) ??
      Purchasing.open({ tenantId: input.tenantId });

    if (
      book.suppliers.some(
        (supplier) => supplier.identification === input.identification,
      )
    ) {
      throw new DuplicateSupplierIdentification();
    }

    book.registerSupplier(supplierFrom(input));
    await this.purchasing.save(book);

    const stored = book.suppliers.find((supplier) => supplier.id === input.id);

    if (!stored) {
      throw new Error("Supplier was not stored.");
    }

    return stored;
  }
}
