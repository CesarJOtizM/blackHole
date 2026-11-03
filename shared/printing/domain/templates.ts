import { type PaperWidth, renderTicket } from "#domain/render.js";

const DOCUMENT = {
  KITCHEN_TICKET: "kitchen_ticket",
  PRE_BILL: "pre_bill",
  INVOICE: "invoice",
  OFFLINE_RECEIPT: "offline_receipt",
  CASH_CLOSE: "cash_close",
  TRANSFER: "transfer",
  TIPS_SETTLEMENT: "tips_settlement",
} as const;

const NOT_AN_INVOICE = "This is not an invoice.";

type TemplateDocument = (typeof DOCUMENT)[keyof typeof DOCUMENT];

export interface KitchenTicketLine {
  quantity: string;
  name: string;
  note?: string;
}

export interface KitchenTicketTemplateInput {
  paper: PaperWidth;
  station: string;
  table: string;
  lines: readonly KitchenTicketLine[];
  kickDrawer: boolean;
}

export interface PreBillLine {
  quantity: string;
  name: string;
  amount: string;
}

export interface PreBillTemplateInput {
  paper: PaperWidth;
  table: string;
  lines: readonly PreBillLine[];
  total: string;
  qr: string;
  kickDrawer: boolean;
}

export interface CashCloseTemplateInput {
  paper: PaperWidth;
  register: string;
  expected: string;
  counted: string;
  difference: string;
  kickDrawer: boolean;
}

export interface TransferTemplateInput {
  paper: PaperWidth;
  reference: string;
  origin: string;
  destination: string;
  lines: readonly string[];
  qr: string;
  kickDrawer: boolean;
}

export interface TipsSettlementLine {
  participant: string;
  amount: string;
}

export interface TipsSettlementTemplateInput {
  paper: PaperWidth;
  period: string;
  lines: readonly TipsSettlementLine[];
  total: string;
  kickDrawer: boolean;
}

export interface InvoiceTemplateInput {
  paper: PaperWidth;
  number: string;
  cufe: string;
  qr: string;
  kickDrawer: boolean;
}

export interface OfflineReceiptTemplateInput {
  paper: PaperWidth;
  lookupQr: string;
  kickDrawer: boolean;
}

export interface RenderedTemplate {
  columns: number;
  text: string;
  pulse: Uint8Array | null;
}

const wrap = (value: string, columns: number): string[] => {
  const lines: string[] = [];

  for (let start = 0; start < value.length; start += columns) {
    lines.push(value.slice(start, start + columns));
  }

  return lines.length === 0 ? [""] : lines;
};

const renderDocument = (
  paper: PaperWidth,
  document: TemplateDocument,
  kickDrawer: boolean,
  parts: readonly string[],
): RenderedTemplate => {
  const rendered = renderTicket({ paper, document, kickDrawer });

  return {
    columns: rendered.columns,
    text: parts.flatMap((part) => wrap(part, rendered.columns)).join("\n"),
    pulse: rendered.pulse,
  };
};

export const renderKitchenTicket = (
  input: KitchenTicketTemplateInput,
): RenderedTemplate =>
  renderDocument(input.paper, DOCUMENT.KITCHEN_TICKET, input.kickDrawer, [
    "Kitchen ticket",
    input.station,
    "Table",
    input.table,
    ...input.lines.flatMap((line) => [
      `${line.quantity} ${line.name}`,
      ...(line.note ? [line.note] : []),
    ]),
  ]);

export const renderPreBill = (input: PreBillTemplateInput): RenderedTemplate =>
  renderDocument(input.paper, DOCUMENT.PRE_BILL, input.kickDrawer, [
    "Pre-bill",
    "Table",
    input.table,
    ...input.lines.map(
      (line) => `${line.quantity} ${line.name} ${line.amount}`,
    ),
    "Total",
    input.total,
    "QR",
    input.qr,
  ]);

export const renderCashClose = (
  input: CashCloseTemplateInput,
): RenderedTemplate =>
  renderDocument(input.paper, DOCUMENT.CASH_CLOSE, input.kickDrawer, [
    "Cash close",
    "Register",
    input.register,
    "Expected",
    input.expected,
    "Counted",
    input.counted,
    "Difference",
    input.difference,
  ]);

export const renderTransfer = (
  input: TransferTemplateInput,
): RenderedTemplate =>
  renderDocument(input.paper, DOCUMENT.TRANSFER, input.kickDrawer, [
    "Transfer",
    "Reference",
    input.reference,
    "Origin",
    input.origin,
    "Destination",
    input.destination,
    ...input.lines,
    "QR",
    input.qr,
  ]);

export const renderTipsSettlement = (
  input: TipsSettlementTemplateInput,
): RenderedTemplate =>
  renderDocument(input.paper, DOCUMENT.TIPS_SETTLEMENT, input.kickDrawer, [
    "Tips settlement",
    "Period",
    input.period,
    ...input.lines.map((line) => `${line.participant} ${line.amount}`),
    "Total",
    input.total,
  ]);

export const renderInvoice = (input: InvoiceTemplateInput): RenderedTemplate =>
  renderDocument(input.paper, DOCUMENT.INVOICE, input.kickDrawer, [
    "Number",
    input.number,
    "CUFE",
    input.cufe,
    "QR",
    input.qr,
  ]);

export const renderOfflineReceipt = (
  input: OfflineReceiptTemplateInput,
): RenderedTemplate =>
  renderDocument(input.paper, DOCUMENT.OFFLINE_RECEIPT, input.kickDrawer, [
    NOT_AN_INVOICE,
    input.lookupQr,
  ]);
