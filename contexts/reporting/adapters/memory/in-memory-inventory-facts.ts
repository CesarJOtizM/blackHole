import type {
  InventoryFacts,
  InventoryFactsQuery,
  InventorySnapshot,
  StoredInventoryFacts,
} from "#application/ports/inventory-facts.js";

const emptySnapshot = (): InventorySnapshot => ({
  movements: [],
  counts: [],
});

const inPeriod = (instant: string, from: string, to: string): boolean =>
  instant >= from && instant < to;

export class InMemoryInventoryFacts implements InventoryFacts {
  constructor(private readonly stored: readonly StoredInventoryFacts[]) {}

  async read(query: InventoryFactsQuery): Promise<InventorySnapshot> {
    const found = this.stored.find(
      (row) => row.tenantId === query.tenantId && row.venueId === query.venueId,
    );

    if (!found) {
      return emptySnapshot();
    }

    return structuredClone({
      movements: found.movements.filter((row) =>
        inPeriod(row.occurredAt, query.from, query.to),
      ),
      counts: found.counts.filter((row) =>
        inPeriod(row.approvedAt, query.from, query.to),
      ),
    });
  }
}
