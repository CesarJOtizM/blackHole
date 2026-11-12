export type SalesChannel = "waiter" | "fixed_point";

export type TenderMethod =
  | "cash"
  | "card"
  | "transfer"
  | "wallet"
  | "voucher"
  | "customer_credit"
  | "corporate_credit";

export type BuyerKind = "generic" | "identified";

export type CaptureSource = "portal" | "register" | "unspecified";

export interface ServiceLineFact {
  checkId: string;
  lineId: string;
  tableId: string | null;
  productId: string;
  productName: string;
  stationId: string | null;
  waiterId: string | null;
  channel: SalesChannel;
  quantity: number;
  grossCop: number;
  discountCop: number;
  includedTaxCop: number;
  tipCop: number;
  voided: boolean;
  diners: number | null;
  openedAt: string | null;
  sentAt: string | null;
  inPreparationAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  requestedAt: string | null;
  chargedAt: string | null;
  releasedAt: string | null;
}

export interface TenderFact {
  checkId: string;
  waiterId: string | null;
  method: TenderMethod;
  amountCop: number;
  tipCop: number;
  chargedAt: string;
}

export interface CashCountFact {
  shiftId: string;
  method: TenderMethod;
  expectedCop: number;
  countedCop: number;
  closedAt: string;
}

export interface StaffHoursFact {
  waiterId: string;
  workedMinutes: number;
  latenessMinutes: number;
  absent: boolean;
  corrected: boolean;
  at: string;
}

export interface InvoiceFact {
  invoiceId: string;
  buyer: BuyerKind;
  capture: CaptureSource;
  reinvoiceCount: number;
  issuedAt: string;
}

export interface OperationSnapshot {
  lines: ServiceLineFact[];
  tenders: TenderFact[];
  cashCounts: CashCountFact[];
  staffHours: StaffHoursFact[];
  invoices: InvoiceFact[];
}

export interface OperationFactsQuery {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
}

export interface StoredOperation {
  tenantId: string;
  venueId: string;
  snapshot: OperationSnapshot;
}

export interface OperationFacts {
  read(query: OperationFactsQuery): Promise<OperationSnapshot>;
}
