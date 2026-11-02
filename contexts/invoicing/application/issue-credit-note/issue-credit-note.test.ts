import { PERMISSION } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  CREDIT_NOTE_OUTCOME,
  CREDIT_NOTE_STATUS,
  type CreditNote,
  CreditNoteRepository,
  IssueCreditNote,
  type IssueCreditNoteCommand,
} from "#application/issue-credit-note/issue-credit-note.js";
import {
  CreditNoteAudit,
  type CreditNoteAuditCommand,
} from "#application/ports/credit-note-audit.js";
import type { InvoiceValidation } from "#application/ports/invoicing-provider.js";
import { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import {
  createSalesDocument,
  SALES_DOCUMENT_STATUS,
  type SalesDocument,
} from "#domain/sales-document.js";

const TENANT_ID = "organization_company_1";
const VENUE_ID = "organization_venue_1";
const ACTOR_ID = "user_admin";
const DEVICE_ID = "device_register";
const CLOSURE_ID = "closure_front_1";
const ORIGINAL_REFERENCE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const CREDIT_NOTE_REFERENCE = "01932f4a-8c3a-7b2d-8e1f-6a5b4c3d2e20";
const TAXPAYER_EMAIL = "facturas@taxpayer.example";
const REASON = "Customer return";

interface SentCreditNote {
  referenceCode: string;
  originalReferenceCode: string;
}

const acceptedOriginal = (): SalesDocument => ({
  ...createSalesDocument({
    closureId: CLOSURE_ID,
    referenceCode: ORIGINAL_REFERENCE,
    taxpayerEmail: TAXPAYER_EMAIL,
  }),
  status: SALES_DOCUMENT_STATUS.ACCEPTED,
});

const commandFor = (
  permissions: readonly string[],
  original: SalesDocument,
): IssueCreditNoteCommand => ({
  permissions,
  original,
  referenceCode: CREDIT_NOTE_REFERENCE,
  tenantId: TENANT_ID,
  actorId: ACTOR_ID,
  authorizerId: null,
  deviceId: DEVICE_ID,
  siteId: VENUE_ID,
  reason: REASON,
});

class MemoryCreditNotes extends CreditNoteRepository {
  readonly rows: CreditNote[] = [];

  constructor(private readonly failSave = false) {
    super();
  }

  override async insert(note: CreditNote): Promise<void> {
    if (this.failSave) {
      throw new Error("The credit note could not be saved.");
    }

    this.rows.push({ ...note });
  }
}

class MemoryInvoicingProvider extends InvoicingProvider {
  readonly validated: InvoiceValidation[] = [];
  readonly creditNotes: SentCreditNote[] = [];

  override async validate(invoice: InvoiceValidation): Promise<void> {
    this.validated.push(invoice);
  }

  override async validateCreditNote(note: SentCreditNote): Promise<void> {
    this.creditNotes.push({ ...note });
  }
}

class RecordingAudit extends CreditNoteAudit {
  readonly calls: CreditNoteAuditCommand[] = [];
  readonly storedBeforeRecord: number[] = [];

  constructor(private readonly notes: MemoryCreditNotes) {
    super();
  }

  override async record(command: CreditNoteAuditCommand): Promise<void> {
    this.storedBeforeRecord.push(this.notes.rows.length);
    this.calls.push({ ...command });
  }
}

const harness = (failSave = false) => {
  const notes = new MemoryCreditNotes(failSave);
  const provider = new MemoryInvoicingProvider();
  const audits = new RecordingAudit(notes);
  const issue = new IssueCreditNote(provider, notes, audits);

  return { notes, provider, audits, issue };
};

it("given an accepted document, when a credit note is issued, then the note cites that original and the original stays unchanged", async () => {
  const original = acceptedOriginal();
  const before = structuredClone(original);
  const { notes, provider, issue } = harness();

  const result = await issue.execute(
    commandFor([PERMISSION.SALE_CREDIT_NOTE], original),
  );

  expect(original).toEqual(before);
  expect(result).toEqual({
    outcome: CREDIT_NOTE_OUTCOME.ISSUED,
    note: {
      referenceCode: CREDIT_NOTE_REFERENCE,
      originalReferenceCode: ORIGINAL_REFERENCE,
      status: CREDIT_NOTE_STATUS.GENERATED,
    },
  });
  expect(notes.rows).toEqual([
    {
      referenceCode: CREDIT_NOTE_REFERENCE,
      originalReferenceCode: ORIGINAL_REFERENCE,
      status: CREDIT_NOTE_STATUS.GENERATED,
    },
  ]);
  expect(provider.creditNotes).toEqual([
    {
      referenceCode: CREDIT_NOTE_REFERENCE,
      originalReferenceCode: ORIGINAL_REFERENCE,
    },
  ]);
  expect(provider.validated).toEqual([]);
});

it("given a cashier without sale.credit-note, when a credit note is requested, then nothing is sent", async () => {
  const original = acceptedOriginal();
  const { notes, provider, audits, issue } = harness();

  const result = await issue.execute(
    commandFor([PERMISSION.SALE_CHARGE], original),
  );

  expect(result).toEqual({ outcome: CREDIT_NOTE_OUTCOME.DENIED });
  expect(provider.creditNotes).toEqual([]);
  expect(provider.validated).toEqual([]);
  expect(notes.rows).toEqual([]);
  expect(audits.calls).toEqual([]);
});

it("given sale.credit-note, when the credit note is saved, then the audit is recorded after the save", async () => {
  const original = acceptedOriginal();
  const { notes, audits, issue } = harness();

  await issue.execute(commandFor([PERMISSION.SALE_CREDIT_NOTE], original));

  expect(audits.storedBeforeRecord).toEqual([1]);
  expect(notes.rows[0]?.originalReferenceCode).toBe(ORIGINAL_REFERENCE);
  expect(audits.calls).toEqual([
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
});

it("given the credit note cannot be saved, when it is issued, then the audit is not recorded", async () => {
  const original = acceptedOriginal();
  const { notes, provider, audits, issue } = harness(true);

  await expect(
    issue.execute(commandFor([PERMISSION.SALE_CREDIT_NOTE], original)),
  ).rejects.toThrow("The credit note could not be saved.");

  expect(provider.creditNotes).toEqual([
    {
      referenceCode: CREDIT_NOTE_REFERENCE,
      originalReferenceCode: ORIGINAL_REFERENCE,
    },
  ]);
  expect(notes.rows).toEqual([]);
  expect(audits.calls).toEqual([]);
  expect(audits.storedBeforeRecord).toEqual([]);
});
