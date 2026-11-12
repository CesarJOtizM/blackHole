import {
  DEFAULT_STALE_AFTER_SECONDS,
  type QrTableSettings,
  type TableQrRecord,
  TableQrRepository,
} from "#application/ports/table-qr-repository.js";

const venueKey = (tenantId: string, venueId: string): string =>
  `${tenantId}\u0000${venueId}`;

const defaultSettings = (
  tenantId: string,
  venueId: string,
): QrTableSettings => ({
  tenantId,
  venueId,
  enabled: true,
  acceptance: "direct",
  staleAfterSeconds: DEFAULT_STALE_AFTER_SECONDS,
});

export class InMemoryTableQrRepository extends TableQrRepository {
  private readonly records = new Map<string, TableQrRecord>();
  private readonly settings = new Map<string, QrTableSettings>();

  override async findByDigest(digest: string): Promise<TableQrRecord | null> {
    const record = this.records.get(digest);

    return record === undefined ? null : structuredClone(record);
  }

  override async save(record: TableQrRecord): Promise<void> {
    this.records.set(record.digest, structuredClone(record));
  }

  override async retireActive(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<void> {
    for (const record of this.records.values()) {
      if (
        record.tenantId === tenantId &&
        record.venueId === venueId &&
        record.tableId === tableId &&
        !record.retired
      ) {
        record.retired = true;
      }
    }
  }

  override async loadSettings(
    tenantId: string,
    venueId: string,
  ): Promise<QrTableSettings> {
    const stored = this.settings.get(venueKey(tenantId, venueId));

    return stored === undefined
      ? defaultSettings(tenantId, venueId)
      : structuredClone(stored);
  }

  override async saveSettings(settings: QrTableSettings): Promise<void> {
    this.settings.set(
      venueKey(settings.tenantId, settings.venueId),
      structuredClone(settings),
    );
  }
}
