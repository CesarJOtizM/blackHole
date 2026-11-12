export const DEFAULT_STALE_AFTER_SECONDS = 900;

export type QrAcceptance = "direct" | "cash_register";

export interface TableQrRecord {
  tenantId: string;
  venueId: string;
  tableId: string;
  digest: string;
  retired: boolean;
}

export interface QrTableSettings {
  tenantId: string;
  venueId: string;
  enabled: boolean;
  acceptance: QrAcceptance;
  staleAfterSeconds: number;
}

export abstract class TableQrRepository {
  abstract findByDigest(digest: string): Promise<TableQrRecord | null>;

  abstract save(record: TableQrRecord): Promise<void>;

  abstract retireActive(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<void>;

  abstract loadSettings(
    tenantId: string,
    venueId: string,
  ): Promise<QrTableSettings>;

  abstract saveSettings(settings: QrTableSettings): Promise<void>;
}
