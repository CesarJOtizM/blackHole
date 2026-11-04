import type { PaymentMethod } from "#domain/payment.js";

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

export interface DrawerOpenJob {
  commandId: string;
  printerId: string;
  document: "drawer_open";
  kickDrawer: true;
}

export interface TipsSettlementMethodLine {
  method: PaymentMethod;
  amountCop: number;
}

export interface TipsSettlementShareLine {
  userId: string;
  amountCop: number;
}

export interface TipsSettlementJob {
  commandId: string;
  printerId: string;
  document: "tips_settlement";
  kickDrawer: false;
  settlementId: string;
  period: string;
  methods: readonly TipsSettlementMethodLine[];
  rule: string;
  residueCop: number;
  shares: readonly TipsSettlementShareLine[];
  poolCop: number;
}

export type SaleReceiptJob =
  | OfflineReceiptJob
  | CashCloseJob
  | DrawerOpenJob
  | TipsSettlementJob;

export interface QueuedSaleReceipt {
  status: "waiting" | "printed" | "failed";
  kickDrawer: boolean;
  deliveredPrinterId?: string | null;
}

export abstract class Printer {
  abstract enqueue(job: SaleReceiptJob): Promise<QueuedSaleReceipt>;
}
