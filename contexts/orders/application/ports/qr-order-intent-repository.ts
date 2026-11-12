import type { QrIntentStatus } from "#domain/qr-order-intent.js";

export interface StoredQrIntentLine {
  productId: string;
  name: string;
  variantIds: readonly string[];
  modifierIds: readonly string[];
  note?: string;
  unitPrice: number;
}

export interface StoredQrOrderIntent {
  id: string;
  tenantId: string;
  venueId: string;
  tableId: string;
  status: QrIntentStatus;
  lines: readonly StoredQrIntentLine[];
  unavailableProductIds: readonly string[];
  sentLineIds: readonly string[];
  checkId: string | null;
  createdAt: string;
}

export abstract class QrOrderIntentRepository {
  abstract find(
    tenantId: string,
    intentId: string,
  ): Promise<StoredQrOrderIntent | null>;

  abstract insert(intent: StoredQrOrderIntent): Promise<void>;

  abstract save(intent: StoredQrOrderIntent): Promise<void>;

  abstract list(
    tenantId: string,
    venueId: string,
  ): Promise<readonly StoredQrOrderIntent[]>;
}
