import {
  type NoRestockMarkQuery,
  NoRestockRepository,
  restoreNoRestockToday,
  type StoredNoRestockMark,
  snapshotNoRestockToday,
} from "#application/ports/no-restock-repository.js";
import type { NoRestockToday } from "#domain/no-restock-today.js";

const rowKey = (row: NoRestockMarkQuery): string =>
  `${row.tenantId}\u0000${row.venueId}\u0000${row.productId}`;

const copy = (stored: StoredNoRestockMark): StoredNoRestockMark => ({
  ...stored,
});

export class InMemoryNoRestockRepository extends NoRestockRepository {
  private readonly rows = new Map<string, StoredNoRestockMark>();

  override async save(mark: NoRestockToday): Promise<void> {
    const stored = snapshotNoRestockToday(mark);
    this.rows.set(rowKey(stored), copy(stored));
  }

  override async find(
    query: NoRestockMarkQuery,
  ): Promise<NoRestockToday | null> {
    const stored = this.rows.get(rowKey(query));

    return stored === undefined ? null : restoreNoRestockToday(copy(stored));
  }
}
