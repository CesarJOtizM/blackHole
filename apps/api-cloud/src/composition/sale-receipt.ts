import {
  DrawerAudit,
  Printer,
  type QueuedSaleReceipt,
  type SaleReceiptJob,
} from "@blackhole/cash-register/application/entry-port";

export class PendingSalePrinter extends Printer {
  override async enqueue(job: SaleReceiptJob): Promise<QueuedSaleReceipt> {
    return { status: "waiting", kickDrawer: job.kickDrawer };
  }
}

export class PendingDrawerAudit extends DrawerAudit {
  override async record(): Promise<void> {
    return undefined;
  }
}
