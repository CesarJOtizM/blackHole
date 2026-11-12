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

export type RealtimeNotice =
  | OrderIds
  | PrinterFailed
  | LineReady
  | BillingDataReceived;

export abstract class RealtimeHub {
  abstract publish(notice: RealtimeNotice): Promise<void>;

  subscribe(_listener: (notice: RealtimeNotice) => void): () => void {
    return () => undefined;
  }
}
