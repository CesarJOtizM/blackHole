import type { PaymentMethod, PaymentTip } from "#domain/payment.js";

export interface TipPoolQuery {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
}

export interface RecordedPaymentTip {
  recordedAt: string;
  tip: PaymentTip;
  saleCop: number;
  taxCop: number;
}

export interface TipMethodTotal {
  method: PaymentMethod;
  amountCop: number;
}

export abstract class TipPool {
  abstract list(query: TipPoolQuery): Promise<readonly RecordedPaymentTip[]>;
}
