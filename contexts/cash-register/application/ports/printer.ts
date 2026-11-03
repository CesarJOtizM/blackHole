export interface OfflineReceiptJob {
  commandId: string;
  printerId: string;
  document: "offline_receipt";
  kickDrawer: boolean;
}

export interface CashCloseJob {
  commandId: string;
  printerId: string;
  document: "cash_close";
  kickDrawer: false;
}

export type SaleReceiptJob = OfflineReceiptJob | CashCloseJob;

export interface QueuedSaleReceipt {
  status: "waiting" | "printed" | "failed";
  kickDrawer: boolean;
}

export abstract class Printer {
  abstract enqueue(job: SaleReceiptJob): Promise<QueuedSaleReceipt>;
}
