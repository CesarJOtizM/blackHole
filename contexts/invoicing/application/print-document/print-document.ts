import {
  SALES_DOCUMENT_STATUS,
  type SalesDocument,
} from "#domain/sales-document.js";

export class SalesDocumentNotPrintable extends Error {
  constructor() {
    super("This sales document has no print payload.");
    this.name = "SalesDocumentNotPrintable";
  }
}

const NOT_AN_INVOICE = "This is not an invoice.";

export interface InvoicePrintPayload {
  document: "invoice";
  number: string;
  cufe: string;
  qr: string;
  kickDrawer: false;
}

export interface OfflineReceiptPrintPayload {
  document: "offline_receipt";
  statement: typeof NOT_AN_INVOICE;
  lookupQr: string;
  kickDrawer: false;
}

export type SalePrintPayload = InvoicePrintPayload | OfflineReceiptPrintPayload;

export interface PrintDocumentCommand {
  document: SalesDocument;
  lookupQr?: string;
}

const issuedInvoice = (document: SalesDocument): InvoicePrintPayload | null => {
  if (
    document.number === undefined ||
    document.cufe === undefined ||
    document.qr === undefined
  ) {
    return null;
  }

  return {
    document: "invoice",
    number: document.number,
    cufe: document.cufe,
    qr: document.qr,
    kickDrawer: false,
  };
};

export class PrintDocument {
  execute(command: PrintDocumentCommand): SalePrintPayload {
    if (command.document.status === SALES_DOCUMENT_STATUS.PENDING_ISSUANCE) {
      if (command.lookupQr === undefined || command.lookupQr.length === 0) {
        throw new SalesDocumentNotPrintable();
      }

      return {
        document: "offline_receipt",
        statement: NOT_AN_INVOICE,
        lookupQr: command.lookupQr,
        kickDrawer: false,
      };
    }

    const invoice = issuedInvoice(command.document);

    if (invoice) {
      return invoice;
    }

    throw new SalesDocumentNotPrintable();
  }
}
