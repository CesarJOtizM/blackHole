export interface SaleReceiptJob {
  commandId: string;
  printerId: string;
  document: "offline_receipt";
  kickDrawer: boolean;
}

export interface QueuedSaleReceipt {
  status: "waiting" | "printed" | "failed";
  kickDrawer: boolean;
}

export abstract class Printer {
  abstract enqueue(job: SaleReceiptJob): Promise<QueuedSaleReceipt>;
}
