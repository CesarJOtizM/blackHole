import { FactusInvoicingProvider } from "@blackhole/invoicing/adapters/factus/factus-invoicing-provider";
import {
  type DocumentIssuance,
  InvoicingProvider,
  IssueDocument,
  type QueuedClosure,
  QueuedClosureReader,
  SalesDocumentRepository,
  type StoredSalesDocument,
} from "@blackhole/invoicing/application/entry-port";
import {
  type CalculateTaxesInput,
  calculateTaxes,
} from "@blackhole/invoicing/domain";
import { FakeClock } from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { InMemoryPendingIssuance } from "@blackhole/platform/adapters/memory/in-memory-pending-issuance";
import { InMemoryProviderRateGate } from "@blackhole/platform/adapters/memory/in-memory-provider-rate-gate";
import { Secrets } from "@blackhole/platform/application/entry-port";
import { expect, it, vi } from "vitest";

import { FactusSimulator } from "#src/composition/factus-simulator.js";
import {
  issueQueuedDocument,
  openIssueDocument,
} from "#src/composition/issue-document.worker.js";
import { issuePending } from "#src/composition/worker.js";

const CLOSURE_ID = "closure_front_1";
const REFERENCE_CODE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
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

const job = {
  closureId: CLOSURE_ID,
  referenceCode: REFERENCE_CODE,
  taxpayerEmail: TAXPAYER_EMAIL,
  documentBalance: 4,
  rules: [INC_RULE],
  siteRangeId: SITE_RANGE,
};

class MemoryQueuedClosures extends QueuedClosureReader {
  constructor(
    private readonly closure: QueuedClosure | null,
    private readonly calls: string[],
  ) {
    super();
  }

  override async read(closureId: string): Promise<QueuedClosure | null> {
    this.calls.push("read");

    if (this.closure === null || closureId !== this.closure.id) {
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
    this.rows.push(stored);
  }
}

class RecordingProvider extends InvoicingProvider<DocumentIssuance> {
  readonly validated: { referenceCode: string }[] = [];

  constructor(private readonly calls: string[]) {
    super();
  }

  override async validate(invoice: {
    referenceCode: string;
  }): Promise<DocumentIssuance> {
    this.calls.push("validate");
    this.validated.push(invoice);

    return {
      number: BILL_NUMBER,
      cufe: INVOICE_CUFE,
      qr: INVOICE_QR,
    };
  }
}

class BlankSecrets extends Secrets {
  override read(name: string): Promise<string> {
    return Promise.resolve(name);
  }
}

const harness = (closure: QueuedClosure | null = CLOSURE) => {
  const calls: string[] = [];
  const taxCalls: CalculateTaxesInput[] = [];
  const documents = new MemorySalesDocuments();
  const provider = new RecordingProvider(calls);
  const issue = new IssueDocument(
    new MemoryQueuedClosures(closure, calls),
    documents,
    provider,
    (input) => {
      calls.push("calculateTaxes");
      taxCalls.push(input);

      return calculateTaxes(input);
    },
  );

  return { calls, taxCalls, documents, provider, issue };
};

it("given a queued closure, when the issue-document worker runs, then it reads the closure, calls CalculateTaxes and InvoicingProvider, and does not listen", async () => {
  const { calls, taxCalls, provider, issue } = harness();

  await issueQueuedDocument(job, issue);

  expect(calls).toEqual(["read", "calculateTaxes", "validate"]);
  expect(calls).not.toContain("listen");
  expect(taxCalls).toEqual([
    {
      rules: [INC_RULE],
      lines: CLOSURE.lines,
      paidCop: CLOSURE.saleCop,
    },
  ]);
  expect(provider.validated).toEqual([{ referenceCode: REFERENCE_CODE }]);
});

it("given no queued closure, when the issue-document worker runs, then CalculateTaxes and InvoicingProvider are not called and it does not listen", async () => {
  const { calls, issue } = harness(null);

  await issueQueuedDocument(job, issue);

  expect(calls).toEqual(["read"]);
  expect(calls).not.toContain("listen");
});

it("given a queued closure and a working provider, when the worker emits it, then the saved document and the job carry number, CUFE, and QR, and a second run does not validate again", async () => {
  const { documents, provider, issue } = harness();

  const first = await issueQueuedDocument(job, issue);
  const second = await issueQueuedDocument(job, issue);

  expect(first).toEqual({
    number: BILL_NUMBER,
    cufe: INVOICE_CUFE,
    qr: INVOICE_QR,
  });
  expect(second).toEqual(first);
  expect(documents.rows).toHaveLength(1);
  expect(documents.rows[0]?.document).toMatchObject({
    number: BILL_NUMBER,
    cufe: INVOICE_CUFE,
    qr: INVOICE_QR,
  });
  expect(provider.validated).toEqual([{ referenceCode: REFERENCE_CODE }]);
});

it("given zero document balance, when the worker emits the closure, then the hold is pending_issuance with no_balance and validate is not called", async () => {
  const { documents, provider, issue } = harness();

  const result = await issueQueuedDocument(
    { ...job, documentBalance: 0 },
    issue,
  );

  expect(result).toBeNull();
  expect(provider.validated).toEqual([]);
  expect(documents.rows).toHaveLength(1);
  expect(documents.rows[0]?.document.status).toBe("pending_issuance");
  expect(documents.rows[0]?.reason).toBe("no_balance");
  expect(documents.rows[0]?.document).not.toHaveProperty("number");
  expect(documents.rows[0]?.document).not.toHaveProperty("cufe");
  expect(documents.rows[0]?.document).not.toHaveProperty("qr");
});

it("given host secrets and a queued closure, when the live opener emits, then Factus validates and the job carries number, CUFE, and QR", async () => {
  const validate = vi
    .spyOn(FactusInvoicingProvider.prototype, "validate")
    .mockResolvedValue({
      number: BILL_NUMBER,
      cufe: INVOICE_CUFE,
      qr: INVOICE_QR,
    });
  const documents = new MemorySalesDocuments();
  const issue = openIssueDocument(new BlankSecrets(), {
    closures: new MemoryQueuedClosures(CLOSURE, []),
    documents,
  });

  try {
    const result = await issueQueuedDocument(job, issue);

    expect(validate).toHaveBeenCalledWith({ referenceCode: REFERENCE_CODE });
    expect(result).toEqual({
      number: BILL_NUMBER,
      cufe: INVOICE_CUFE,
      qr: INVOICE_QR,
    });
    expect(documents.rows).toHaveLength(1);
  } finally {
    validate.mockRestore();
  }
});

it("given the 0.9 issue-pending probe, when it runs, then FactusSimulator issues the sale and InvoicingProvider is not called", async () => {
  const provider = new RecordingProvider([]);

  const outcome = await issuePending(
    {
      taxId: "900111111",
      at: new Date("2026-10-22T12:00:10.000Z"),
      sales: [{ id: "sale-a", soldAt: 10 }],
    },
    {
      providerRate: new InMemoryProviderRateGate(),
      pendingIssuance: new InMemoryPendingIssuance(new FakeClock(1_000)),
      factus: new FactusSimulator(),
    },
  );

  expect(outcome.issuedSaleIds).toEqual(["sale-a"]);
  expect(outcome.responses).toEqual([]);
  expect(provider.validated).toEqual([]);
});
