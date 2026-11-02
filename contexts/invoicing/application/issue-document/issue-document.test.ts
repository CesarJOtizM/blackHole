import { expect, it } from "vitest";
import { IssueDocument } from "#application/issue-document/issue-document.js";
import type {
  DocumentIssuance,
  InvoiceValidation,
} from "#application/ports/invoicing-provider.js";
import { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import type { QueuedClosure } from "#application/ports/queued-closure-reader.js";
import { QueuedClosureReader } from "#application/ports/queued-closure-reader.js";
import type { StoredSalesDocument } from "#application/ports/sales-document-repository.js";
import { SalesDocumentRepository } from "#application/ports/sales-document-repository.js";
import type {
  CalculateTaxesInput,
  TaxBreakdown,
} from "#domain/calculate-taxes.js";
import { calculateTaxes } from "#domain/calculate-taxes.js";

const CLOSURE_ID = "closure_front_1";
const REFERENCE_CODE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const OTHER_REFERENCE_CODE = "01932f4a-7c3a-7b2d-9e1f-6a5b4c3d2e10";
const TAXPAYER_EMAIL = "facturas@taxpayer.example";
const SITE_RANGE = "range_site";
const BILL_NUMBER = "SETP990000550";
const INVOICE_CUFE = "cufe-recorded";
const INVOICE_QR = "qr-recorded";

const INC_RULE = {
  id: "tax_rule_inc_8",
  version: 7,
  taxClassification: "restaurant service",
  taxes: [{ code: "04", rate: "0.08" }],
};

const CLOSURE: QueuedClosure = {
  id: CLOSURE_ID,
  status: "queued",
  saleCop: 100_000,
  tipCop: 10_000,
  lines: [{ priceCop: 100_000, taxClassification: "restaurant service" }],
  payments: [{ method: "cash", amountCop: 110_000 }],
};

const command = {
  closureId: CLOSURE_ID,
  referenceCode: REFERENCE_CODE,
  taxpayerEmail: TAXPAYER_EMAIL,
  documentBalance: 0,
  rules: [INC_RULE],
  siteRangeId: SITE_RANGE,
};

class MemoryQueuedClosures extends QueuedClosureReader {
  readonly reads: string[] = [];

  constructor(private readonly closure: QueuedClosure) {
    super();
  }

  override async read(closureId: string): Promise<QueuedClosure | null> {
    this.reads.push(closureId);

    if (closureId !== this.closure.id || this.closure.status !== "queued") {
      return null;
    }

    return this.closure;
  }
}

class MemorySalesDocuments extends SalesDocumentRepository {
  readonly rows: StoredSalesDocument[] = [];

  override async findByClosureId(
    closureId: string,
  ): Promise<StoredSalesDocument | null> {
    return (
      this.rows.find((row) => row.document.closureId === closureId) ?? null
    );
  }

  override async insert(stored: StoredSalesDocument): Promise<void> {
    const duplicate = this.rows.some(
      (row) => row.document.closureId === stored.document.closureId,
    );

    if (duplicate) {
      throw new Error("A closure already has a sales document.");
    }

    this.rows.push(stored);
  }
}

class MemoryInvoicingProvider extends InvoicingProvider<DocumentIssuance> {
  readonly validated: InvoiceValidation[] = [];

  override async validate(
    invoice: InvoiceValidation,
  ): Promise<DocumentIssuance> {
    this.validated.push(invoice);

    return {
      number: BILL_NUMBER,
      cufe: INVOICE_CUFE,
      qr: INVOICE_QR,
    };
  }
}

const harness = () => {
  const taxCalls: CalculateTaxesInput[] = [];
  const closures = new MemoryQueuedClosures(CLOSURE);
  const documents = new MemorySalesDocuments();
  const provider = new MemoryInvoicingProvider();
  const saleTaxes = (input: CalculateTaxesInput): TaxBreakdown => {
    taxCalls.push(input);

    return calculateTaxes(input);
  };
  const issue = new IssueDocument(closures, documents, provider, saleTaxes);

  return { taxCalls, closures, documents, provider, issue };
};

it("given a queued closure with a tip, when the document is issued, then CalculateTaxes receives the tax lines and the sale total without the tip", async () => {
  const { taxCalls, closures, issue } = harness();
  const sale = calculateTaxes({
    rules: [INC_RULE],
    lines: [{ priceCop: 100_000, taxClassification: "restaurant service" }],
    paidCop: 100_000,
  });
  const tipInsideTheBase = calculateTaxes({
    rules: [INC_RULE],
    lines: [{ priceCop: 110_000, taxClassification: "restaurant service" }],
    paidCop: 110_000,
  });

  const result = await issue.execute(command);

  expect(closures.reads).toEqual([CLOSURE_ID]);
  expect(taxCalls).toEqual([
    {
      rules: [INC_RULE],
      lines: [{ priceCop: 100_000, taxClassification: "restaurant service" }],
      paidCop: 100_000,
    },
  ]);
  expect(result.content.tip).toEqual({
    code: "03",
    reason: "propina",
    amountCop: 10_000,
  });
  expect(result.content.lines[0]?.taxes).toEqual(sale.lines[0]?.taxes);
  expect(result.content.lines[0]?.taxes).not.toEqual(
    tipInsideTheBase.lines[0]?.taxes,
  );
});

it("given zero document balance, when the sale closes, then the document is pending_issuance with no_balance and validate is not called", async () => {
  const { provider, documents, issue } = harness();

  const result = await issue.execute(command);

  expect(result.document).toMatchObject({
    closureId: CLOSURE_ID,
    referenceCode: REFERENCE_CODE,
    status: "pending_issuance",
  });
  expect(result.reason).toBe("no_balance");
  expect(result.document.buyer.email).toBe(TAXPAYER_EMAIL);
  expect(result.document).not.toHaveProperty("number");
  expect(result.document).not.toHaveProperty("cufe");
  expect(result.document).not.toHaveProperty("qr");
  expect(provider.validated).toEqual([]);
  expect(documents.rows).toHaveLength(1);
});

it("given a closure that already has a document, when another is requested, then that document is returned", async () => {
  const { provider, documents, issue } = harness();
  const first = await issue.execute(command);

  const repeated = await issue.execute({
    ...command,
    referenceCode: OTHER_REFERENCE_CODE,
    taxpayerEmail: "other@taxpayer.example",
  });

  expect(repeated.document).toBe(first.document);
  expect(repeated.reason).toBe("no_balance");
  expect(repeated.document.referenceCode).toBe(REFERENCE_CODE);
  expect(repeated.document.buyer.email).toBe(TAXPAYER_EMAIL);
  expect(documents.rows).toHaveLength(1);
  expect(provider.validated).toEqual([]);
});

it("given document balance remains, when the closure is issued, then validate receives the reference and the document stays generated", async () => {
  const { provider, issue } = harness();

  const result = await issue.execute({
    ...command,
    documentBalance: 12,
  });

  expect(result.document.status).toBe("generated");
  expect(result.reason).toBeNull();
  expect(provider.validated).toEqual([{ referenceCode: REFERENCE_CODE }]);
});

it("given a closed sale and a working provider, when the document is emitted, then the caller receives number, CUFE, and QR", async () => {
  const { documents, issue } = harness();

  const result = await issue.execute({
    ...command,
    documentBalance: 12,
  });

  expect(result.document.number).toBe(BILL_NUMBER);
  expect(result.document.cufe).toBe(INVOICE_CUFE);
  expect(result.document.qr).toBe(INVOICE_QR);
  expect(documents.rows).toHaveLength(1);
  expect(documents.rows[0]?.document).toMatchObject({
    number: BILL_NUMBER,
    cufe: INVOICE_CUFE,
    qr: INVOICE_QR,
  });
});
