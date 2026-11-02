import { expect, it } from "vitest";

import {
  DOCUMENT_HOLD_REASON,
  SALES_DOCUMENT_DUPLICATE,
  type SalesDocumentRepository,
  type StoredSalesDocument,
} from "#application/ports/sales-document-repository.js";
import { SALES_DOCUMENT_STATUS } from "#domain/sales-document.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const CLOSURE_ID = "closure_front_1";
const REFERENCE_CODE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const OTHER_REFERENCE_CODE = "01932f4a-7c3a-7b2d-9e1f-6a5b4c3d2e10";

export interface TenantSalesDocuments {
  forTenant(tenantId: string): SalesDocumentRepository;
}

const documentFor = (
  closureId: string,
  referenceCode: string,
): StoredSalesDocument => ({
  document: {
    closureId,
    referenceCode,
    status: SALES_DOCUMENT_STATUS.PENDING_ISSUANCE,
    buyer: {
      documentType: "13",
      documentNumber: "222222222222",
      name: "Consumidor final",
      responsibility: "R-99-PN",
      email: "facturas@taxpayer.example",
    },
  },
  reason: DOCUMENT_HOLD_REASON.NO_BALANCE,
  content: {
    numberingRangeId: "range_register",
    lines: [
      {
        base: 100_000,
        taxes: [{ code: "04", rate: "0.08", amount: 8_000 }],
        ruleId: "tax_rule_inc_8",
        version: 7,
      },
    ],
    payments: [{ method: "cash", code: "10", form: "1", amountCop: 110_000 }],
    tip: { code: "03", reason: "propina", amountCop: 10_000 },
    cashRoundingAmount: 0,
  },
});

const expectRoundTrip = (
  found: StoredSalesDocument,
  stored: StoredSalesDocument,
): void => {
  const line = found.content.lines[0];
  const storedLine = stored.content.lines[0];

  expect(found).toEqual(stored);
  expect(found).not.toBe(stored);
  expect(found).not.toHaveProperty("tenantId");
  expect(found.document).not.toBe(stored.document);
  expect(found.document).not.toHaveProperty("tenantId");
  expect(found.document.buyer).not.toBe(stored.document.buyer);
  expect(found.content).not.toBe(stored.content);
  expect(found.content.lines).not.toBe(stored.content.lines);
  expect(line).not.toBe(storedLine);
  expect(line?.taxes).not.toBe(storedLine?.taxes);
  expect(line?.taxes[0]).not.toBe(storedLine?.taxes[0]);
  expect(found.content.payments).not.toBe(stored.content.payments);
  expect(found.content.payments[0]).not.toBe(stored.content.payments[0]);
  expect(found.content.tip).not.toBe(stored.content.tip);
};

const mutate = (stored: StoredSalesDocument): void => {
  const line = stored.content.lines[0];
  const tax = line?.taxes[0];
  const payment = stored.content.payments[0];

  stored.document.status = SALES_DOCUMENT_STATUS.ACCEPTED;
  stored.document.buyer.email = "edited@taxpayer.example";
  stored.reason = null;
  stored.content.numberingRangeId = "range_edited";
  stored.content.cashRoundingAmount = 50;

  if (line !== undefined) {
    line.base = 1;
  }

  if (tax !== undefined) {
    tax.amount = 1;
    tax.rate = "0.19";
  }

  if (payment !== undefined) {
    payment.amountCop = 1;
  }

  if (stored.content.tip !== null) {
    stored.content.tip.amountCop = 1;
  }
};

export function salesDocumentRepositoryContract(
  open: () => TenantSalesDocuments | Promise<TenantSalesDocuments>,
): void {
  it("given a sales document, when it is inserted, then findByClosureId returns an equal copy", async () => {
    const documents = await open();
    const repository = documents.forTenant(TENANT_A);
    const stored = documentFor(CLOSURE_ID, REFERENCE_CODE);

    await repository.insert(stored);

    const found = await repository.findByClosureId(CLOSURE_ID);

    if (found === null) {
      throw new Error("Expected the stored sales document.");
    }

    expectRoundTrip(found, stored);
  });

  it("given an issued sales document, when it is stored, then number, CUFE, and QR round-trip", async () => {
    const documents = await open();
    const repository = documents.forTenant(TENANT_A);
    const stored = documentFor(CLOSURE_ID, REFERENCE_CODE);
    stored.document.status = SALES_DOCUMENT_STATUS.GENERATED;
    stored.reason = null;
    stored.document.number = "SETP990000550";
    stored.document.cufe = "cufe-recorded";
    stored.document.qr = "qr-recorded";

    await repository.insert(stored);

    const found = await repository.findByClosureId(CLOSURE_ID);

    if (found === null) {
      throw new Error("Expected the stored sales document.");
    }

    expectRoundTrip(found, stored);
  });

  it("given the object returned by findByClosureId, when it is mutated, then the stored document stays unchanged", async () => {
    const documents = await open();
    const repository = documents.forTenant(TENANT_A);
    const stored = documentFor(CLOSURE_ID, REFERENCE_CODE);
    await repository.insert(stored);

    const found = await repository.findByClosureId(CLOSURE_ID);

    if (found === null) {
      throw new Error("Expected the stored sales document.");
    }

    mutate(found);

    const reread = await repository.findByClosureId(CLOSURE_ID);
    expect(reread).toEqual(stored);
  });

  it("given an inserted sales document, when the inserted object is mutated, then the stored document stays unchanged", async () => {
    const documents = await open();
    const repository = documents.forTenant(TENANT_A);
    const stored = documentFor(CLOSURE_ID, REFERENCE_CODE);
    const expected = documentFor(CLOSURE_ID, REFERENCE_CODE);

    await repository.insert(stored);

    mutate(stored);

    expect(await repository.findByClosureId(CLOSURE_ID)).toEqual(expected);
  });

  it("given a document stored for tenant A, when tenant B finds that closure, then each tenant stays hidden from the other", async () => {
    const documents = await open();
    const tenantA = documents.forTenant(TENANT_A);
    const tenantB = documents.forTenant(TENANT_B);
    const storedA = documentFor(CLOSURE_ID, REFERENCE_CODE);
    const storedB = documentFor(CLOSURE_ID, OTHER_REFERENCE_CODE);
    storedB.document.buyer.email = "other@taxpayer.example";

    await tenantA.insert(storedA);

    expect(await tenantB.findByClosureId(CLOSURE_ID)).toBeNull();

    await tenantB.insert(storedB);

    expect(await tenantA.findByClosureId(CLOSURE_ID)).toEqual(storedA);
    expect(await tenantB.findByClosureId(CLOSURE_ID)).toEqual(storedB);
  });

  it("given one document for a closure, when that closure is inserted again, then the closure still has one row", async () => {
    const documents = await open();
    const repository = documents.forTenant(TENANT_A);
    const stored = documentFor(CLOSURE_ID, REFERENCE_CODE);
    const replacement = documentFor(CLOSURE_ID, OTHER_REFERENCE_CODE);

    await repository.insert(stored);

    await expect(repository.insert(replacement)).rejects.toThrow(
      SALES_DOCUMENT_DUPLICATE,
    );

    expect(await repository.findByClosureId(CLOSURE_ID)).toEqual(stored);
  });

  it("given a sales document repository, when the instance is inspected, then it has no update method and no delete method", async () => {
    const documents = await open();
    const repository = documents.forTenant(TENANT_A);

    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });
}
