import { PERMISSION } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  APPROVE_REINVOICE,
  ApproveReinvoice,
  type ApproveReinvoiceCommand,
} from "#application/approve-reinvoice/approve-reinvoice.js";
import {
  CREDIT_NOTE_STATUS,
  type CreditNote,
  CreditNoteRepository,
  IssueCreditNote,
  type IssueCreditNoteCommand,
  type IssueCreditNoteResult,
} from "#application/issue-credit-note/issue-credit-note.js";
import type { IssueDocumentCommand } from "#application/issue-document/issue-document.js";
import { IssueDocument } from "#application/issue-document/issue-document.js";
import {
  CreditNoteAudit,
  type CreditNoteAuditCommand,
} from "#application/ports/credit-note-audit.js";
import type {
  CreditNoteValidation,
  DocumentIssuance,
} from "#application/ports/invoicing-provider.js";
import { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import {
  PORTAL_REINVOICE_REQUEST_STATUS,
  PortalRepository,
  type StoredPortalReinvoiceRequest,
} from "#application/ports/portal-repository.js";
import { QueuedClosureReader } from "#application/ports/queued-closure-reader.js";
import type { StoredSalesDocument } from "#application/ports/sales-document-repository.js";
import { SalesDocumentRepository } from "#application/ports/sales-document-repository.js";
import { REINVOICE_WINDOW_MODE } from "#domain/reinvoice-window.js";
import {
  createSalesDocument,
  SALES_DOCUMENT_STATUS,
  type SalesDocument,
} from "#domain/sales-document.js";

const COMPANY_ID = "company-a";
const OTHER_COMPANY_ID = "company-b";
const INVOICE_NUMBER = "FV-200";
const PAYLOAD = "consumer-final-line";
const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const ACTOR_ID = "user_admin";
const DEVICE_ID = "device_register";
const CLOSURE_ID = "closure_front_1";
const ORIGINAL_REFERENCE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const CREDIT_NOTE_REFERENCE = "01932f4a-8c3a-7b2d-8e1f-6a5b4c3d2e20";
const TAXPAYER_EMAIL = "facturas@taxpayer.example";
const REASON = "Customer asked to re-invoice";
const ISSUED_BOGOTA_DAY_START = "2026-11-05T05:30:00.000Z";
const AT_SAME_BOGOTA_DAY = "2026-11-05T18:00:00.000Z";
const APPROVAL_NEXT_BOGOTA_DAY = "2026-11-06T05:30:00.000Z";
const UNREADABLE = "not-a-time";
const LOG_METHODS = ["log", "info", "debug", "warn", "error"] as const;

const NO_PROVIDER_CALLS = {
  validate: 0,
  downloadPdf: 0,
  lookupAcquirer: 0,
  validateCreditNote: 0,
  findByReference: 0,
};

const NEXT_INVOICE: IssueDocumentCommand = {
  closureId: "closure_reinvoice_1",
  referenceCode: "01932f4a-9c3a-7b2d-8e1f-6a5b4c3d2e21",
  taxpayerEmail: "buyer@customer.example",
  documentBalance: 1,
  rules: [],
  siteRangeId: "range-site-1",
};

const CREDIT_NOTE_FIELDS = {
  referenceCode: CREDIT_NOTE_REFERENCE,
  tenantId: TENANT_ID,
  actorId: ACTOR_ID,
  authorizerId: null,
  deviceId: DEVICE_ID,
  siteId: VENUE_ID,
  reason: REASON,
} satisfies Omit<IssueCreditNoteCommand, "permissions" | "original">;

const acceptedOriginal = (): SalesDocument => ({
  ...createSalesDocument({
    closureId: CLOSURE_ID,
    referenceCode: ORIGINAL_REFERENCE,
    taxpayerEmail: TAXPAYER_EMAIL,
  }),
  status: SALES_DOCUMENT_STATUS.ACCEPTED,
  number: INVOICE_NUMBER,
});

const storedRequest = (
  overrides: Partial<StoredPortalReinvoiceRequest> = {},
): StoredPortalReinvoiceRequest => ({
  companyId: COMPANY_ID,
  invoiceNumber: INVOICE_NUMBER,
  issuedAt: ISSUED_BOGOTA_DAY_START,
  requestedAt: AT_SAME_BOGOTA_DAY,
  status: PORTAL_REINVOICE_REQUEST_STATUS.PENDING,
  ...overrides,
});

const command = (
  original: SalesDocument,
  overrides: Partial<ApproveReinvoiceCommand> = {},
): ApproveReinvoiceCommand => ({
  companyId: COMPANY_ID,
  invoiceNumber: INVOICE_NUMBER,
  at: AT_SAME_BOGOTA_DAY,
  windowMode: REINVOICE_WINDOW_MODE.SAME_DAY,
  permissions: [PERMISSION.SALE_CREDIT_NOTE],
  original,
  creditNote: CREDIT_NOTE_FIELDS,
  invoice: NEXT_INVOICE,
  ...overrides,
});

const watch = async <T>(body: () => Promise<T>) => {
  const lines: string[] = [];
  const prior = LOG_METHODS.map((name) => console[name]);

  for (const name of LOG_METHODS) {
    console[name] = ((...args: readonly unknown[]) => {
      lines.push(args.map((arg) => String(arg)).join(" "));
    }) as typeof console.log;
  }

  try {
    return { result: await body(), logs: lines.join("\n") };
  } finally {
    LOG_METHODS.forEach((name, index) => {
      console[name] = prior[index] as typeof console.log;
    });
  }
};

const keepsQuiet = (
  logs: string,
  original: SalesDocument,
  before: SalesDocument,
) => {
  expect(original).toEqual(before);
  expect(logs).not.toContain(INVOICE_NUMBER);
  expect(logs).not.toContain(PAYLOAD);
  expect(logs).not.toContain(NEXT_INVOICE.referenceCode);
  expect(logs).not.toContain(CREDIT_NOTE_REFERENCE);
};

class MemoryPortalRequests extends PortalRepository {
  readonly rows = new Map<string, StoredPortalReinvoiceRequest>();
  saves = 0;

  override async save(row: StoredPortalReinvoiceRequest): Promise<void> {
    this.saves += 1;
    this.rows.set(`${row.companyId}:${row.invoiceNumber}`, { ...row });
  }

  override async find(
    companyId: string,
    invoiceNumber: string,
  ): Promise<StoredPortalReinvoiceRequest | null> {
    const row = this.rows.get(`${companyId}:${invoiceNumber}`);

    return row === undefined ? null : { ...row };
  }
}

class MemoryCreditNotes extends CreditNoteRepository {
  readonly rows: CreditNote[] = [];

  override async insert(note: CreditNote): Promise<void> {
    this.rows.push({ ...note });
  }
}

class RecordingAudit extends CreditNoteAudit {
  readonly calls: CreditNoteAuditCommand[] = [];

  override async record(entry: CreditNoteAuditCommand): Promise<void> {
    this.calls.push({ ...entry });
  }
}

class RecordingProvider extends InvoicingProvider {
  readonly operations: string[] = [];
  readonly creditNotes: CreditNoteValidation[] = [];
  readonly calls = {
    validate: 0,
    downloadPdf: 0,
    lookupAcquirer: 0,
    validateCreditNote: 0,
    findByReference: 0,
  };

  override async validate(): Promise<void> {
    this.calls.validate += 1;
    this.operations.push("invoice");
  }

  override async downloadPdf(): Promise<Uint8Array> {
    this.calls.downloadPdf += 1;

    return Uint8Array.from([]);
  }

  override async lookupAcquirer(): Promise<{ outcome: "empty" }> {
    this.calls.lookupAcquirer += 1;

    return { outcome: "empty" };
  }

  override async validateCreditNote(note: CreditNoteValidation): Promise<void> {
    this.calls.validateCreditNote += 1;
    this.creditNotes.push({ ...note });
    this.operations.push("credit-note");
  }

  override async findByReference(): Promise<{ outcome: "empty" }> {
    this.calls.findByReference += 1;

    return { outcome: "empty" };
  }
}

class CountingDocumentProvider extends InvoicingProvider<DocumentIssuance> {
  readonly calls = { ...NO_PROVIDER_CALLS };

  override async validate(): Promise<DocumentIssuance> {
    this.calls.validate += 1;

    return { number: INVOICE_NUMBER, cufe: "cufe", qr: "qr" };
  }

  override async downloadPdf(): Promise<Uint8Array> {
    this.calls.downloadPdf += 1;

    return Uint8Array.from([]);
  }

  override async lookupAcquirer(): Promise<{ outcome: "empty" }> {
    this.calls.lookupAcquirer += 1;

    return { outcome: "empty" };
  }

  override async validateCreditNote(): Promise<void> {
    this.calls.validateCreditNote += 1;
  }

  override async findByReference(): Promise<{ outcome: "empty" }> {
    this.calls.findByReference += 1;

    return { outcome: "empty" };
  }
}

class CountingCreditNotes extends IssueCreditNote {
  executions = 0;

  override async execute(
    entry: IssueCreditNoteCommand,
  ): Promise<IssueCreditNoteResult> {
    this.executions += 1;

    return super.execute(entry);
  }
}

class ClosedClosures extends QueuedClosureReader {
  override read(): Promise<null> {
    return Promise.resolve(null);
  }
}

class MemoryDocuments extends SalesDocumentRepository {
  override findByClosureId(): Promise<null> {
    return Promise.resolve(null);
  }

  override insert(): Promise<void> {
    return Promise.resolve();
  }
}

const issuedDocument = (): StoredSalesDocument => ({
  document: {
    closureId: NEXT_INVOICE.closureId,
    referenceCode: NEXT_INVOICE.referenceCode,
    status: SALES_DOCUMENT_STATUS.ACCEPTED,
    buyer: {
      documentType: "13",
      documentNumber: "222222222222",
      name: "Consumidor final",
      responsibility: "R-99-PN",
      email: NEXT_INVOICE.taxpayerEmail,
    },
  },
  reason: null,
  content: {
    numberingRangeId: NEXT_INVOICE.siteRangeId,
    lines: [],
    payments: [],
    tip: null,
    cashRoundingAmount: 0,
  },
});

class RecordingInvoices extends IssueDocument {
  readonly commands: IssueDocumentCommand[] = [];
  readonly creditNotesAtCall: number[] = [];

  constructor(
    private readonly operations: string[],
    private readonly sentNotes: readonly CreditNoteValidation[],
    closures: QueuedClosureReader,
    documents: SalesDocumentRepository,
    provider: InvoicingProvider<DocumentIssuance>,
  ) {
    super(closures, documents, provider);
  }

  override async execute(
    entry: IssueDocumentCommand,
  ): Promise<StoredSalesDocument> {
    this.creditNotesAtCall.push(this.sentNotes.length);
    this.operations.push("invoice");
    this.commands.push({ ...entry, rules: [...entry.rules] });

    return issuedDocument();
  }
}

const harness = async (row: StoredPortalReinvoiceRequest = storedRequest()) => {
  const requests = new MemoryPortalRequests();
  await requests.save(row);
  const seededSaves = requests.saves;
  const provider = new RecordingProvider();
  const notes = new MemoryCreditNotes();
  const audits = new RecordingAudit();
  const creditNotes = new CountingCreditNotes(provider, notes, audits);
  const invoiceProvider = new CountingDocumentProvider();
  const invoices = new RecordingInvoices(
    provider.operations,
    provider.creditNotes,
    new ClosedClosures(),
    new MemoryDocuments(),
    invoiceProvider,
  );
  const useCase = new ApproveReinvoice(requests, creditNotes, invoices);

  return {
    requests,
    seededSaves,
    provider,
    notes,
    audits,
    creditNotes,
    invoices,
    invoiceProvider,
    useCase,
  };
};

it("given a cashier without sale.credit-note and an open window, when re-invoicing is approved, then the outcome is denied and nothing is stored, audited, or issued", async () => {
  const original = acceptedOriginal();
  const before = structuredClone(original);
  const run = await harness();

  const watched = await watch(() =>
    run.useCase.execute(
      command(original, { permissions: [PERMISSION.SALE_CHARGE] }),
    ),
  );

  expect(watched.result).toEqual({ outcome: APPROVE_REINVOICE.DENIED });
  expect(run.creditNotes.executions).toBe(1);
  expect(run.provider.calls).toEqual(NO_PROVIDER_CALLS);
  expect(run.provider.operations).toEqual([]);
  expect(run.notes.rows).toEqual([]);
  expect(run.audits.calls).toEqual([]);
  expect(run.invoices.commands).toEqual([]);
  expect(run.invoiceProvider.calls).toEqual(NO_PROVIDER_CALLS);
  expect(run.requests.saves).toBe(run.seededSaves);
  expect(await run.requests.find(COMPANY_ID, INVOICE_NUMBER)).toEqual(
    storedRequest(),
  );
  keepsQuiet(watched.logs, original, before);
});

it("given a request recorded inside the window, when approval is outside that window or the mode is off, then it is rejected without a credit note or the provider", async () => {
  const cases = [
    {
      at: APPROVAL_NEXT_BOGOTA_DAY,
      windowMode: REINVOICE_WINDOW_MODE.SAME_DAY,
      row: storedRequest(),
    },
    {
      at: AT_SAME_BOGOTA_DAY,
      windowMode: REINVOICE_WINDOW_MODE.OFF,
      row: storedRequest(),
    },
    {
      at: AT_SAME_BOGOTA_DAY,
      windowMode: REINVOICE_WINDOW_MODE.SAME_DAY,
      row: storedRequest({ issuedAt: UNREADABLE }),
    },
  ];

  for (const entry of cases) {
    const original = acceptedOriginal();
    const before = structuredClone(original);
    const run = await harness(entry.row);

    const watched = await watch(() =>
      run.useCase.execute(
        command(original, { at: entry.at, windowMode: entry.windowMode }),
      ),
    );

    expect(watched.result).toEqual({ outcome: APPROVE_REINVOICE.REJECTED });
    expect(run.creditNotes.executions).toBe(0);
    expect(run.provider.calls).toEqual(NO_PROVIDER_CALLS);
    expect(run.provider.operations).toEqual([]);
    expect(run.notes.rows).toEqual([]);
    expect(run.audits.calls).toEqual([]);
    expect(run.invoices.commands).toEqual([]);
    expect(run.invoiceProvider.calls).toEqual(NO_PROVIDER_CALLS);
    expect(run.requests.saves).toBe(run.seededSaves);
    expect(await run.requests.find(COMPANY_ID, INVOICE_NUMBER)).toEqual(
      entry.row,
    );
    keepsQuiet(watched.logs, original, before);
  }
});

it("given sale.credit-note and an open window, when re-invoicing is approved, then concept code 2 is delegated through one credit note, the new invoice follows acceptance, and two documents are consumed", async () => {
  const original = acceptedOriginal();
  const before = structuredClone(original);
  const run = await harness();

  const watched = await watch(() => run.useCase.execute(command(original)));

  expect(watched.result).toEqual({ outcome: APPROVE_REINVOICE.APPROVED });
  expect(run.creditNotes.executions).toBe(1);
  expect(run.provider.creditNotes).toEqual([
    {
      referenceCode: CREDIT_NOTE_REFERENCE,
      originalReferenceCode: ORIGINAL_REFERENCE,
    },
  ]);
  expect(Object.keys(run.provider.creditNotes[0] ?? {}).toSorted()).toEqual([
    "originalReferenceCode",
    "referenceCode",
  ]);
  expect(run.provider.operations).toEqual(["credit-note", "invoice"]);
  expect(run.invoices.creditNotesAtCall).toEqual([1]);
  expect(run.invoices.commands).toEqual([NEXT_INVOICE]);
  expect(run.notes.rows).toEqual([
    {
      referenceCode: CREDIT_NOTE_REFERENCE,
      originalReferenceCode: ORIGINAL_REFERENCE,
      status: CREDIT_NOTE_STATUS.GENERATED,
    },
  ]);
  expect(run.audits.calls).toEqual([
    {
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      authorizerId: null,
      deviceId: DEVICE_ID,
      siteId: VENUE_ID,
      action: PERMISSION.SALE_CREDIT_NOTE,
      entity: CREDIT_NOTE_REFERENCE,
      before: ORIGINAL_REFERENCE,
      after: CREDIT_NOTE_REFERENCE,
      reason: REASON,
    },
  ]);
  expect(run.provider.calls).toEqual({
    ...NO_PROVIDER_CALLS,
    validateCreditNote: 1,
  });
  expect(run.invoiceProvider.calls).toEqual(NO_PROVIDER_CALLS);
  expect(run.requests.saves).toBe(run.seededSaves + 1);
  expect(await run.requests.find(COMPANY_ID, INVOICE_NUMBER)).toEqual(
    storedRequest({ status: PORTAL_REINVOICE_REQUEST_STATUS.APPROVED }),
  );

  const again = await run.useCase.execute(command(original));

  expect(again).toEqual({ outcome: APPROVE_REINVOICE.REJECTED });
  expect(run.creditNotes.executions).toBe(1);
  expect(run.invoices.commands).toEqual([NEXT_INVOICE]);
  expect(run.provider.operations).toEqual(["credit-note", "invoice"]);
  keepsQuiet(watched.logs, original, before);

  const monthOriginal = acceptedOriginal();
  const monthBefore = structuredClone(monthOriginal);
  const month = await harness();

  const monthWatched = await watch(() =>
    month.useCase.execute(
      command(monthOriginal, {
        at: APPROVAL_NEXT_BOGOTA_DAY,
        windowMode: REINVOICE_WINDOW_MODE.SAME_MONTH,
      }),
    ),
  );

  expect(monthWatched.result).toEqual({ outcome: APPROVE_REINVOICE.APPROVED });
  expect(month.provider.operations).toEqual(["credit-note", "invoice"]);
  expect(month.invoices.commands).toHaveLength(1);
  expect(month.audits.calls).toHaveLength(1);
  keepsQuiet(monthWatched.logs, monthOriginal, monthBefore);
});

it("given another company's pending request, when this company approves that invoice number, then it is not approved", async () => {
  const original = acceptedOriginal();
  const before = structuredClone(original);
  const run = await harness();

  const watched = await watch(() =>
    run.useCase.execute(command(original, { companyId: OTHER_COMPANY_ID })),
  );

  expect(watched.result).toEqual({ outcome: APPROVE_REINVOICE.REJECTED });
  expect(run.creditNotes.executions).toBe(0);
  expect(run.provider.calls).toEqual(NO_PROVIDER_CALLS);
  expect(run.invoices.commands).toEqual([]);
  expect(run.audits.calls).toEqual([]);
  expect(await run.requests.find(COMPANY_ID, INVOICE_NUMBER)).toEqual(
    storedRequest(),
  );
  expect(await run.requests.find(OTHER_COMPANY_ID, INVOICE_NUMBER)).toBeNull();
  keepsQuiet(watched.logs, original, before);
});
