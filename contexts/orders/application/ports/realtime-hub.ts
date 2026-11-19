import type { InventoryState } from "#domain/menu.js";

export interface OrderIds {
  kind: "ids";
  tenantId: string;
  venueId: string;
  checkId: string;
  tableId: string;
  lineIds: readonly string[];
}

export interface PrinterFailed {
  kind: "printer_failed";
  tenantId: string;
  venueId: string;
  checkId: string;
  tableId: string;
  lineId?: string;
  stationId?: string;
  text?: string;
}

export interface LineReady {
  kind: "line_ready";
  tenantId: string;
  venueId: string;
  checkId: string;
  tableId: string;
  lineId: string;
  at: string;
}

export interface BillingDataReceived {
  kind: "billing_data_received";
  tenantId: string;
  venueId: string;
  checkId: string;
  tableId: string;
}

export interface NotRestocked {
  kind: "not_restocked";
  tenantId: string;
  venueId: string;
  checkId: string;
  tableId: string;
  productId: string;
  lineIds: readonly string[];
  at: string;
}

export interface AvailabilityChanged {
  kind: "availability_changed";
  tenantId: string;
  venueId: string;
  productId: string;
  variantId: string | null;
  state: InventoryState;
}

export type RealtimeNotice =
  | OrderIds
  | PrinterFailed
  | LineReady
  | BillingDataReceived
  | NotRestocked
  | AvailabilityChanged;

export abstract class RealtimeHub {
  abstract publish(notice: RealtimeNotice): Promise<void>;

  subscribe(_listener: (notice: RealtimeNotice) => void): () => void {
    return () => undefined;
  }
}
