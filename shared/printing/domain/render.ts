const PAPER_COLUMNS = {
  "80": 48,
  "58": 32,
} as const;

const PRINT_DOCUMENT = {
  KITCHEN_TICKET: "kitchen_ticket",
  PRE_BILL: "pre_bill",
  INVOICE: "invoice",
  OFFLINE_RECEIPT: "offline_receipt",
  CASH_CLOSE: "cash_close",
  TRANSFER: "transfer",
  TIPS_SETTLEMENT: "tips_settlement",
} as const;

const DRAWER_PULSE = Uint8Array.of(0x1b, 0x70, 0x00, 0x19, 0xfa);

const DRAWER_DOCUMENTS = new Set<PrintDocument>([
  PRINT_DOCUMENT.INVOICE,
  PRINT_DOCUMENT.OFFLINE_RECEIPT,
]);

export type PaperWidth = keyof typeof PAPER_COLUMNS;

export type PrintDocument =
  (typeof PRINT_DOCUMENT)[keyof typeof PRINT_DOCUMENT];

export class DrawerKickRejected extends Error {
  constructor() {
    super("The drawer opens only on an invoice or a receipt.");
    this.name = "DrawerKickRejected";
  }
}

export interface RenderedTicket {
  columns: number;
  pulse: Uint8Array | null;
}

export interface RenderTicketInput {
  paper: PaperWidth;
  document: PrintDocument;
  kickDrawer: boolean;
}

export const renderTicket = (input: RenderTicketInput): RenderedTicket => {
  if (input.kickDrawer && !DRAWER_DOCUMENTS.has(input.document)) {
    throw new DrawerKickRejected();
  }

  return {
    columns: PAPER_COLUMNS[input.paper],
    pulse: input.kickDrawer ? Uint8Array.from(DRAWER_PULSE) : null,
  };
};
