export interface KitchenTicketLine {
  quantity: string;
  name: string;
  note?: string;
}

export interface PreBillLine {
  quantity: string;
  name: string;
  amount: string;
}

interface PrintCommand {
  commandId: string;
  kickDrawer: false;
}

export interface KitchenTicketJob extends PrintCommand {
  document: "kitchen_ticket";
  stationId: string;
  station: string;
  table: string;
  lines: readonly KitchenTicketLine[];
}

export interface PreBillJob extends PrintCommand {
  document: "pre_bill";
  table: string;
  lines: readonly PreBillLine[];
  total: string;
  qr: string;
}

export type PrintJobRequest = KitchenTicketJob | PreBillJob;

export type PrintJobStatus = "waiting" | "printed" | "failed";

export interface QueuedPrintJob {
  status: PrintJobStatus;
  kickDrawer: boolean;
}

export abstract class Printer {
  abstract enqueue(job: PrintJobRequest): Promise<QueuedPrintJob>;
}
