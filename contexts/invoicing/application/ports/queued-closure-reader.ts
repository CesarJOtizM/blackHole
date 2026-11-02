import type { TaxLine } from "#domain/calculate-taxes.js";
import type { DocumentPayment } from "#domain/document-content.js";

export const QUEUED_CLOSURE_STATUS = {
  QUEUED: "queued",
} as const;

export type QueuedClosureStatus =
  (typeof QUEUED_CLOSURE_STATUS)[keyof typeof QUEUED_CLOSURE_STATUS];

export interface QueuedClosure {
  id: string;
  status: QueuedClosureStatus;
  saleCop: number;
  tipCop: number;
  lines: readonly TaxLine[];
  payments: readonly DocumentPayment[];
}

export abstract class QueuedClosureReader {
  abstract read(closureId: string): Promise<QueuedClosure | null>;
}
