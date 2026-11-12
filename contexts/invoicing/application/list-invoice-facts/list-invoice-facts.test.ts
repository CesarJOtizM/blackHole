import { ListInvoiceFacts as ListedOnEntryPort } from "@blackhole/invoicing/application/entry-port";
import { expect, it } from "vitest";
import {
  type InvoiceTax,
  type IssuedInvoice,
  IssuedInvoiceReader,
  ListInvoiceFacts,
} from "#application/list-invoice-facts/list-invoice-facts.js";
import {
  PORTAL_REINVOICE_REQUEST_STATUS,
  PortalRepository,
  type StoredPortalReinvoiceRequest,
} from "#application/ports/portal-repository.js";

const COMPANY = "company_1";
const FROM = "2026-11-01T05:00:00.000Z";
const TO = "2026-12-01T05:00:00.000Z";
const GENERIC_DOCUMENT_NUMBER = "222222222222";
const VAT: InvoiceTax = { code: "01", amountCop: 1_900 };
const INC: InvoiceTax = { code: "04", amountCop: 800 };

const invoice = (
  invoiceNumber: string,
  issuedAt: string,
  buyerDocumentNumber: string,
  buyerName: string,
  taxes: readonly InvoiceTax[],
): IssuedInvoice => ({
  invoiceNumber,
  issuedAt,
  buyerDocumentNumber,
  buyerName,
  taxes,
});

const generic = invoice(
  "FV-100",
  "2026-11-11T18:00:00.000Z",
  GENERIC_DOCUMENT_NUMBER,
  "Consumidor final",
  [VAT],
);
const identified = invoice(
  "FV-200",
  "2026-11-11T19:00:00.000Z",
  "900123456-8",
  "Ana Mesa",
  [VAT, INC],
);
const pendingBuyer = invoice(
  "FV-300",
  "2026-11-11T20:00:00.000Z",
  "1234567890",
  "Luis Peña",
  [{ code: "01", amountCop: 500 }],
);
const outside = invoice(
  "FV-000",
  "2026-10-01T18:00:00.000Z",
  "900123456-8",
  "Ana Mesa",
  [VAT],
);

const request = (
  invoiceNumber: string,
  status: StoredPortalReinvoiceRequest["status"],
): StoredPortalReinvoiceRequest => ({
  companyId: COMPANY,
  invoiceNumber,
  issuedAt: "2026-11-11T18:00:00.000Z",
  requestedAt: "2026-11-12T15:00:00.000Z",
  status,
});

class MemoryInvoices extends IssuedInvoiceReader {
  constructor(private readonly rows: readonly IssuedInvoice[]) {
    super();
  }

  override async list(): Promise<readonly IssuedInvoice[]> {
    return this.rows;
  }
}

class MemoryPortal extends PortalRepository {
  constructor(private readonly rows: readonly StoredPortalReinvoiceRequest[]) {
    super();
  }

  override async save(_row: StoredPortalReinvoiceRequest): Promise<void> {}

  override async find(
    companyId: string,
    invoiceNumber: string,
  ): Promise<StoredPortalReinvoiceRequest | null> {
    return (
      this.rows.find(
        (row) =>
          row.companyId === companyId && row.invoiceNumber === invoiceNumber,
      ) ?? null
    );
  }
}

const period = { companyId: COMPANY, from: FROM, to: TO };

it("given the invoicing entry port, when invoice facts are resolved, then the port exposes the same use case", () => {
  expect(ListedOnEntryPort).toBe(ListInvoiceFacts);
});

it("given generic and identified invoices, when invoice facts are listed, then buyer kind, taxes, and approved reinvoices are kept", async () => {
  const listed = new ListInvoiceFacts(
    new MemoryInvoices([outside, identified, generic, pendingBuyer]),
    new MemoryPortal([
      request("FV-200", PORTAL_REINVOICE_REQUEST_STATUS.APPROVED),
      request("FV-300", PORTAL_REINVOICE_REQUEST_STATUS.PENDING),
      request("FV-000", PORTAL_REINVOICE_REQUEST_STATUS.APPROVED),
    ]),
  );

  const result = await listed.execute(period);

  expect(result).toEqual([
    {
      invoiceNumber: "FV-100",
      issuedAt: generic.issuedAt,
      buyer: "generic",
      taxes: [VAT],
      taxCop: 1_900,
      reinvoiceCount: 0,
    },
    {
      invoiceNumber: "FV-200",
      issuedAt: identified.issuedAt,
      buyer: "identified",
      taxes: [VAT, INC],
      taxCop: 2_700,
      reinvoiceCount: 1,
    },
    {
      invoiceNumber: "FV-300",
      issuedAt: pendingBuyer.issuedAt,
      buyer: "identified",
      taxes: [{ code: "01", amountCop: 500 }],
      taxCop: 500,
      reinvoiceCount: 0,
    },
  ]);
});
