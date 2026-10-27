import {
  type ClockEntry,
  ClockEntryRepository,
  type ListClockEntries,
} from "#application/ports/clock-entry-repository.js";

const clone = (entry: ClockEntry): ClockEntry => ({ ...entry });

const sameCommand = (row: ClockEntry, entry: ClockEntry): boolean =>
  row.tenantId === entry.tenantId && row.commandId === entry.commandId;

export class InMemoryClockEntryRepository extends ClockEntryRepository {
  private readonly rows: ClockEntry[] = [];

  override async append(entry: ClockEntry): Promise<void> {
    if (this.rows.some((row) => sameCommand(row, entry))) {
      return;
    }

    this.rows.push(clone(entry));
  }

  override async findByCommand(
    tenantId: string,
    commandId: string,
  ): Promise<ClockEntry | null> {
    const row = this.rows.find(
      (item) => item.tenantId === tenantId && item.commandId === commandId,
    );

    return row === undefined ? null : clone(row);
  }

  override async list(query: ListClockEntries): Promise<readonly ClockEntry[]> {
    return this.rows
      .filter(
        (row) =>
          row.tenantId === query.tenantId &&
          row.venueId === query.venueId &&
          row.userId === query.userId,
      )
      .map(clone);
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClockEntry[]> {
    return this.rows
      .filter((row) => row.tenantId === tenantId && row.venueId === venueId)
      .map(clone);
  }
}
