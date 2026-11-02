import { expect, it } from "vitest";
import type { InvoiceValidation } from "#application/ports/invoicing-provider.js";
import {
  InvoicingProvider,
  REFERENCE_LOOKUP,
  type ReferenceLookup,
  ReferenceQueryFailed,
} from "#application/ports/invoicing-provider.js";
import {
  RejectionAlert,
  VerifyIssuance,
  type VerifyIssuanceCommand,
} from "#application/verify-issuance/verify-issuance.js";
import {
  createSalesDocument,
  SALES_DOCUMENT_STATUS,
  type SalesDocument,
  type SalesDocumentStatus,
} from "#domain/sales-document.js";

const CLOSURE_ID = "closure_front_1";
const REFERENCE_CODE = "01932f4a-7c3a-7b2d-8e1f-6a5b4c3d2e1f";
const REPLACEMENT_REFERENCE_CODE = "01932f4a-8c3a-7b2d-8e1f-6a5b4c3d2e20";
const TAXPAYER_EMAIL = "facturas@taxpayer.example";
const INVOICE_NUMBER = "FV-100";
const INVOICE_CUFE = "cufe-fv-100";

const PROVIDER_OPERATION = {
  FIND: "findByReference",
  DELETE: "deleteAttempt",
  VALIDATE: "validate",
} as const;

type ProviderOperation =
  (typeof PROVIDER_OPERATION)[keyof typeof PROVIDER_OPERATION];

interface ProviderStep {
  operation: ProviderOperation;
  referenceCode: string;
}

const documentWith = (status: SalesDocumentStatus): SalesDocument => ({
  ...createSalesDocument({
    closureId: CLOSURE_ID,
    referenceCode: REFERENCE_CODE,
    taxpayerEmail: TAXPAYER_EMAIL,
  }),
  status,
});

const commandFor = (status: SalesDocumentStatus): VerifyIssuanceCommand => ({
  document: documentWith(status),
  replacementReferenceCode: REPLACEMENT_REFERENCE_CODE,
});

class MemoryInvoicingProvider extends InvoicingProvider {
  readonly steps: ProviderStep[] = [];
  readonly validated: InvoiceValidation[] = [];
  readonly deleted: string[] = [];

  constructor(
    private readonly lookup: ReferenceLookup,
    private readonly failQuery = false,
  ) {
    super();
  }

  override async validate(invoice: InvoiceValidation): Promise<void> {
    this.steps.push({
      operation: PROVIDER_OPERATION.VALIDATE,
      referenceCode: invoice.referenceCode,
    });
    this.validated.push(invoice);
  }

  override async findByReference(
    referenceCode: string,
  ): Promise<ReferenceLookup> {
    this.steps.push({
      operation: PROVIDER_OPERATION.FIND,
      referenceCode,
    });

    if (this.failQuery) {
      throw new ReferenceQueryFailed();
    }

    return this.lookup;
  }

  override async deleteAttempt(referenceCode: string): Promise<void> {
    this.steps.push({
      operation: PROVIDER_OPERATION.DELETE,
      referenceCode,
    });
    this.deleted.push(referenceCode);
  }
}

class MemoryRejectionAlerts extends RejectionAlert {
  readonly references: string[] = [];

  override async raise(referenceCode: string): Promise<void> {
    this.references.push(referenceCode);
  }
}

const harness = (lookup: ReferenceLookup, failQuery = false) => {
  const provider = new MemoryInvoicingProvider(lookup, failQuery);
  const alerts = new MemoryRejectionAlerts();
  const verify = new VerifyIssuance(provider, alerts);

  return { provider, alerts, verify };
};

it("given a send with an empty provider response, when issuance is verified, then the document is uncertain", async () => {
  const { provider, alerts, verify } = harness({
    outcome: REFERENCE_LOOKUP.EMPTY,
  });

  const result = await verify.execute(
    commandFor(SALES_DOCUMENT_STATUS.SENDING),
  );

  expect(result.document.status).toBe(SALES_DOCUMENT_STATUS.UNCERTAIN);
  expect(result.document.referenceCode).toBe(REFERENCE_CODE);
  expect(result.number).toBeNull();
  expect(result.cufe).toBeNull();
  expect(result.followUp).toBe("none");
  expect(provider.validated).toEqual([]);
  expect(provider.deleted).toEqual([]);
  expect(alerts.references).toEqual([]);
});

it("given an uncertain document the provider validated, when verification runs, then its number and CUFE are kept and nothing is resent", async () => {
  const { provider, verify } = harness({
    outcome: REFERENCE_LOOKUP.VALIDATED,
    number: INVOICE_NUMBER,
    cufe: INVOICE_CUFE,
  });

  const result = await verify.execute(
    commandFor(SALES_DOCUMENT_STATUS.UNCERTAIN),
  );

  expect(result.number).toBe(INVOICE_NUMBER);
  expect(result.cufe).toBe(INVOICE_CUFE);
  expect(result.document).toMatchObject({
    closureId: CLOSURE_ID,
    referenceCode: REFERENCE_CODE,
    status: SALES_DOCUMENT_STATUS.ACCEPTED,
  });
  expect(result.followUp).toBe("none");
  expect(provider.validated).toEqual([]);
  expect(provider.deleted).toEqual([]);
});

it("given an uncertain document still pending, when verification runs, then that attempt is deleted and the same reference is resent", async () => {
  const { provider, alerts, verify } = harness({
    outcome: REFERENCE_LOOKUP.PENDING,
  });

  const result = await verify.execute(
    commandFor(SALES_DOCUMENT_STATUS.UNCERTAIN),
  );

  expect(provider.steps).toEqual([
    { operation: "findByReference", referenceCode: REFERENCE_CODE },
    { operation: "deleteAttempt", referenceCode: REFERENCE_CODE },
    { operation: "validate", referenceCode: REFERENCE_CODE },
  ]);
  expect(result.document.referenceCode).toBe(REFERENCE_CODE);
  expect(result.followUp).toBe("resend");
  expect(alerts.references).toEqual([]);
});

it("given an uncertain document the provider does not have, when verification runs, then it is resent with the same reference", async () => {
  const { provider, verify } = harness({
    outcome: REFERENCE_LOOKUP.MISSING,
  });

  const result = await verify.execute(
    commandFor(SALES_DOCUMENT_STATUS.UNCERTAIN),
  );

  expect(provider.steps).toEqual([
    { operation: "findByReference", referenceCode: REFERENCE_CODE },
    { operation: "validate", referenceCode: REFERENCE_CODE },
  ]);
  expect(provider.deleted).toEqual([]);
  expect(result.document.referenceCode).toBe(REFERENCE_CODE);
  expect(result.followUp).toBe("resend");
});

it("given an uncertain document and a failed query, when verification is attempted, then it stays uncertain and backs off without resending", async () => {
  const { provider, alerts, verify } = harness(
    { outcome: REFERENCE_LOOKUP.MISSING },
    true,
  );

  const result = await verify.execute(
    commandFor(SALES_DOCUMENT_STATUS.UNCERTAIN),
  );

  expect(result.document.status).toBe(SALES_DOCUMENT_STATUS.UNCERTAIN);
  expect(result.document.referenceCode).toBe(REFERENCE_CODE);
  expect(result.followUp).toBe("backoff");
  expect(provider.steps).toEqual([
    { operation: "findByReference", referenceCode: REFERENCE_CODE },
  ]);
  expect(provider.validated).toEqual([]);
  expect(provider.deleted).toEqual([]);
  expect(alerts.references).toEqual([]);
});

it("given the provider rejects a document, when it is resent, then an alert is raised and the document uses a new reference", async () => {
  const { provider, alerts, verify } = harness({
    outcome: REFERENCE_LOOKUP.REJECTED,
  });

  const result = await verify.execute(
    commandFor(SALES_DOCUMENT_STATUS.UNCERTAIN),
  );

  expect(alerts.references).toEqual([REFERENCE_CODE]);
  expect(result.document.referenceCode).toBe(REPLACEMENT_REFERENCE_CODE);
  expect(result.document.closureId).toBe(CLOSURE_ID);
  expect(provider.validated).toEqual([
    { referenceCode: REPLACEMENT_REFERENCE_CODE },
  ]);
  expect(provider.deleted).toEqual([]);
  expect(result.followUp).toBe("resend");
});
