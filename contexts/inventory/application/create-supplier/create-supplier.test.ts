import { expect, it } from "vitest";

import { InMemoryPurchasingRepository } from "#adapters/memory/in-memory-purchasing-repository.js";
import {
  CreateSupplier,
  DuplicateSupplierIdentification,
} from "#application/create-supplier/create-supplier.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const NIT = "900123456";

const supplierFields = [
  "id",
  "identification",
  "issuesEInvoices",
  "leadTimeDays",
  "name",
];

it("given a supplier with NIT 900123456, when another supplier with the same NIT is created in that company, then it is rejected", async () => {
  const purchasing = new InMemoryPurchasingRepository();
  const create = new CreateSupplier(purchasing);
  await create.execute({
    tenantId: TENANT_A,
    id: "supplier_market",
    identification: NIT,
    name: "Market",
    issuesEInvoices: false,
    leadTimeDays: 2,
  });

  const again = create.execute({
    tenantId: TENANT_A,
    id: "supplier_other",
    identification: NIT,
    name: "Other market",
    issuesEInvoices: true,
    leadTimeDays: 1,
  });

  await expect(again).rejects.toThrow(DuplicateSupplierIdentification);
  expect((await purchasing.load(TENANT_A))?.suppliers).toEqual([
    {
      id: "supplier_market",
      identification: NIT,
      name: "Market",
      issuesEInvoices: false,
      leadTimeDays: 2,
    },
  ]);
});

it("given a supplier, when another company reuses the NIT, then issues e-invoices and lead time are stored without a document, Factus, or VAT", async () => {
  const purchasing = new InMemoryPurchasingRepository();
  const create = new CreateSupplier(purchasing);
  await create.execute({
    tenantId: TENANT_A,
    id: "supplier_market",
    identification: NIT,
    name: "Market",
    issuesEInvoices: false,
    leadTimeDays: 2,
  });

  const stored = await create.execute({
    tenantId: TENANT_B,
    id: "supplier_other",
    identification: NIT,
    name: "Other market",
    issuesEInvoices: true,
    leadTimeDays: 4,
  });

  expect(stored).toEqual({
    id: "supplier_other",
    identification: NIT,
    name: "Other market",
    issuesEInvoices: true,
    leadTimeDays: 4,
  });
  expect(Object.keys(stored).toSorted()).toEqual(supplierFields);
  expect((await purchasing.load(TENANT_A))?.suppliers).toHaveLength(1);
  expect((await purchasing.load(TENANT_B))?.suppliers).toEqual([stored]);
});
