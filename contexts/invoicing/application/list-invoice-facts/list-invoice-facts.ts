import {
  PORTAL_REINVOICE_REQUEST_STATUS,
  type PortalRepository,
} from "#application/ports/portal-repository.js";

const GENERIC_DOCUMENT_NUMBER = "222222222222";
const GENERIC_BUYER_NAME = "Consumidor final";

export const INVOICE_BUYER = {
  GENERIC: "generic",
  IDENTIFIED: "identified",
} as const;

export type InvoiceBuyer = (typeof INVOICE_BUYER)[keyof typeof INVOICE_BUYER];

export interface InvoiceTax {
  code: string;
  amountCop: number;
}

export interface IssuedInvoice {
  invoiceNumber: string;
  issuedAt: string;
  buyerDocumentNumber: string;
  buyerName: string;
  taxes: readonly InvoiceTax[];
}

export interface InvoiceFact {
  invoiceNumber: string;
  issuedAt: string;
  buyer: InvoiceBuyer;
  taxes: readonly InvoiceTax[];
  taxCop: number;
  reinvoiceCount: number;
}

export interface ListInvoiceFactsCommand {
  companyId: string;
  from: string;
  to: string;
}

export abstract class IssuedInvoiceReader {
  abstract list(
    query: ListInvoiceFactsCommand,
  ): Promise<readonly IssuedInvoice[]>;
}

const inPeriod = (issuedAt: string, from: string, to: string): boolean =>
  issuedAt >= from && issuedAt < to;

const buyerOf = (invoice: IssuedInvoice): InvoiceBuyer =>
  invoice.buyerDocumentNumber === GENERIC_DOCUMENT_NUMBER &&
  invoice.buyerName === GENERIC_BUYER_NAME
    ? INVOICE_BUYER.GENERIC
    : INVOICE_BUYER.IDENTIFIED;

const factFor = async (
  invoice: IssuedInvoice,
  companyId: string,
  portal: PortalRepository,
): Promise<InvoiceFact> => {
  const stored = await portal.find(companyId, invoice.invoiceNumber);
  const taxes = invoice.taxes.map((tax) => ({
    code: tax.code,
    amountCop: tax.amountCop,
  }));

  return {
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt,
    buyer: buyerOf(invoice),
    taxes,
    taxCop: taxes.reduce((sum, tax) => sum + tax.amountCop, 0),
    reinvoiceCount:
      stored?.status === PORTAL_REINVOICE_REQUEST_STATUS.APPROVED ? 1 : 0,
  };
};

export class ListInvoiceFacts {
  constructor(
    private readonly invoices: IssuedInvoiceReader,
    private readonly portal: PortalRepository,
  ) {}

  async execute(
    command: ListInvoiceFactsCommand,
  ): Promise<readonly InvoiceFact[]> {
    const listed = await this.invoices.list(command);
    const inWindow = listed
      .filter((row) => inPeriod(row.issuedAt, command.from, command.to))
      .toSorted((left, right) =>
        left.invoiceNumber.localeCompare(right.invoiceNumber),
      );

    return Promise.all(
      inWindow.map((invoice) =>
        factFor(invoice, command.companyId, this.portal),
      ),
    );
  }
}
