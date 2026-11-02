import type { Secrets } from "@blackhole/platform/application/entry-port";

import {
  ACQUIRER_LOOKUP,
  type AcquirerLookup,
  AcquirerLookupFailed,
  type AcquirerQuery,
  type CreditNoteValidation,
  CreditNoteValidationFailed,
  type DocumentIssuance,
  type InvoiceValidation,
  InvoicingProvider,
  REFERENCE_LOOKUP,
  type ReferenceLookup,
  ReferenceQueryFailed,
} from "#application/ports/invoicing-provider.js";

export const FACTUS_SECRET = {
  BASE_URL: "factus.base-url",
  CLIENT_ID: "factus.client-id",
  CLIENT_SECRET: "factus.client-secret",
  USERNAME: "factus.username",
  PASSWORD: "factus.password",
} as const;

const FACTUS_DOCUMENT = {
  SALES_INVOICE: "01",
} as const;

const FACTUS_CREDIT_NOTE = {
  ANNULMENT: "2",
  REFERENCES_INVOICE: "20",
} as const;

const FACTUS_BILL_STATUS = {
  PENDING: 0,
  VALIDATED: 1,
} as const;

const FACTUS_PATH = {
  TOKEN: "/oauth/token",
  VALIDATE_BILL: "/v2/bills/validate",
  BILLS: "/v2/bills",
  DESTROY_BILL: "/v2/bills/destroy/reference",
  ACQUIRER: "/v2/dian/acquirer",
  VALIDATE_CREDIT_NOTE: "/v2/credit-notes/validate",
} as const;

const FACTUS_REJECTION_MARK = "rechazo";

const GRANT_TYPE = {
  PASSWORD: "password",
} as const;

export class FactusValidationFailed extends Error {
  constructor() {
    super("The provider could not validate the bill.");
    this.name = "FactusValidationFailed";
  }
}

interface FactusBillBody {
  document: typeof FACTUS_DOCUMENT.SALES_INVOICE;
  reference_code: string;
}

interface FactusCreditNoteBody {
  reference_code: string;
  correction_concept_code: typeof FACTUS_CREDIT_NOTE.ANNULMENT;
  customization_id: typeof FACTUS_CREDIT_NOTE.REFERENCES_INVOICE;
  bill_number: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const readJson = (value: string): unknown => JSON.parse(value) as unknown;

const stripTrailingSlash = (value: string): string =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const providerError = (error: Error): boolean =>
  error instanceof FactusValidationFailed ||
  error instanceof ReferenceQueryFailed ||
  error instanceof AcquirerLookupFailed ||
  error instanceof CreditNoteValidationFailed;

const toFactusBill = (invoice: InvoiceValidation): FactusBillBody => ({
  document: FACTUS_DOCUMENT.SALES_INVOICE,
  reference_code: invoice.referenceCode,
});

const toFactusCreditNote = (
  note: CreditNoteValidation,
): FactusCreditNoteBody => ({
  reference_code: note.referenceCode,
  correction_concept_code: FACTUS_CREDIT_NOTE.ANNULMENT,
  customization_id: FACTUS_CREDIT_NOTE.REFERENCES_INVOICE,
  bill_number: note.originalReferenceCode,
});

const reportsRejection = (errors: unknown): boolean => {
  if (!isRecord(errors)) {
    return false;
  }

  return Object.values(errors).some(
    (value) =>
      typeof value === "string" &&
      value.toLowerCase().includes(FACTUS_REJECTION_MARK),
  );
};

const lookupFromBill = (bill: Record<string, unknown>): ReferenceLookup => {
  const validated =
    bill.status === FACTUS_BILL_STATUS.VALIDATED || bill.is_validated === true;

  if (validated) {
    const number = text(bill.number);
    const cufe = text(bill.cufe);

    if (number === null || cufe === null) {
      throw new ReferenceQueryFailed();
    }

    return {
      outcome: REFERENCE_LOOKUP.VALIDATED,
      number,
      cufe,
    };
  }

  if (reportsRejection(bill.errors)) {
    return { outcome: REFERENCE_LOOKUP.REJECTED };
  }

  if (
    bill.status === FACTUS_BILL_STATUS.PENDING ||
    bill.is_validated === false
  ) {
    return { outcome: REFERENCE_LOOKUP.PENDING };
  }

  throw new ReferenceQueryFailed();
};

const billRows = (payload: unknown): unknown[] | null => {
  if (payload === null) {
    return null;
  }

  if (!isRecord(payload)) {
    throw new ReferenceQueryFailed();
  }

  if (!("data" in payload) || payload.data === null) {
    return null;
  }

  if (!isRecord(payload.data) || !Array.isArray(payload.data.data)) {
    throw new ReferenceQueryFailed();
  }

  return payload.data.data;
};

const referenceLookup = (payload: unknown): ReferenceLookup => {
  const rows = billRows(payload);

  if (rows === null) {
    return { outcome: REFERENCE_LOOKUP.EMPTY };
  }

  if (rows.length === 0) {
    return { outcome: REFERENCE_LOOKUP.MISSING };
  }

  const bill = rows[0];

  if (rows.length !== 1 || !isRecord(bill)) {
    throw new ReferenceQueryFailed();
  }

  return lookupFromBill(bill);
};

const issuanceFrom = (payload: unknown): DocumentIssuance => {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new FactusValidationFailed();
  }

  const number = text(payload.data.number);
  const cufe = text(payload.data.cufe);
  const qr = text(payload.data.qr);

  if (number === null || cufe === null || qr === null) {
    throw new FactusValidationFailed();
  }

  return { number, cufe, qr };
};

const acquirerLookup = (payload: unknown): AcquirerLookup => {
  if (payload === null) {
    return { outcome: ACQUIRER_LOOKUP.EMPTY };
  }

  if (!isRecord(payload)) {
    throw new AcquirerLookupFailed();
  }

  if (!("data" in payload) || payload.data === null) {
    return { outcome: ACQUIRER_LOOKUP.EMPTY };
  }

  if (!isRecord(payload.data)) {
    throw new AcquirerLookupFailed();
  }

  const name = text(payload.data.name);
  const email = text(payload.data.email);

  if (name === null || email === null) {
    return { outcome: ACQUIRER_LOOKUP.EMPTY };
  }

  return {
    outcome: ACQUIRER_LOOKUP.FOUND,
    name,
    email,
  };
};

export class FactusInvoicingProvider extends InvoicingProvider<DocumentIssuance> {
  constructor(private readonly secrets: Secrets) {
    super();
  }

  override async validate(
    invoice: InvoiceValidation,
  ): Promise<DocumentIssuance> {
    const payload = await this.send(
      FACTUS_PATH.VALIDATE_BILL,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toFactusBill(invoice)),
      },
      () => new FactusValidationFailed(),
    );

    return issuanceFrom(payload);
  }

  override async findByReference(
    referenceCode: string,
  ): Promise<ReferenceLookup> {
    const payload = await this.send(
      `${FACTUS_PATH.BILLS}?filter[reference_code]=${encodeURIComponent(referenceCode)}`,
      { method: "GET" },
      () => new ReferenceQueryFailed(),
    );

    return referenceLookup(payload);
  }

  override async deleteAttempt(referenceCode: string): Promise<void> {
    await this.send(
      `${FACTUS_PATH.DESTROY_BILL}/${encodeURIComponent(referenceCode)}`,
      { method: "DELETE" },
      () => new ReferenceQueryFailed(),
    );
  }

  override async lookupAcquirer(query: AcquirerQuery): Promise<AcquirerLookup> {
    const payload = await this.send(
      `${FACTUS_PATH.ACQUIRER}?identification_document_code=${encodeURIComponent(query.documentType)}&identification_number=${encodeURIComponent(query.documentNumber)}`,
      { method: "GET" },
      () => new AcquirerLookupFailed(),
    );

    return acquirerLookup(payload);
  }

  override async validateCreditNote(note: CreditNoteValidation): Promise<void> {
    await this.send(
      FACTUS_PATH.VALIDATE_CREDIT_NOTE,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toFactusCreditNote(note)),
      },
      () => new CreditNoteValidationFailed(),
    );
  }

  private async send(
    path: string,
    init: RequestInit,
    error: () => Error,
  ): Promise<unknown> {
    try {
      const baseUrl = stripTrailingSlash(
        (await this.secrets.read(FACTUS_SECRET.BASE_URL)).trim(),
      );

      if (baseUrl.length === 0) {
        throw error();
      }

      const token = await this.accessToken(baseUrl, error);
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          ...init.headers,
        },
      });

      if (!response.ok) {
        throw error();
      }

      const body = await response.text();

      if (body.trim().length === 0) {
        return null;
      }

      return readJson(body);
    } catch (caught) {
      if (caught instanceof Error && providerError(caught)) {
        throw caught;
      }

      throw error();
    }
  }

  private async accessToken(
    baseUrl: string,
    error: () => Error,
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: GRANT_TYPE.PASSWORD,
      client_id: await this.secrets.read(FACTUS_SECRET.CLIENT_ID),
      client_secret: await this.secrets.read(FACTUS_SECRET.CLIENT_SECRET),
      username: await this.secrets.read(FACTUS_SECRET.USERNAME),
      password: await this.secrets.read(FACTUS_SECRET.PASSWORD),
    });
    const response = await fetch(`${baseUrl}${FACTUS_PATH.TOKEN}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw error();
    }

    const payload = readJson(await response.text());
    const token = isRecord(payload) ? text(payload.access_token) : null;

    if (token === null) {
      throw error();
    }

    return token;
  }
}
