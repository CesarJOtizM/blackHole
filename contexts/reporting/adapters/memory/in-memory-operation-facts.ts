import type {
  OperationFacts,
  OperationFactsQuery,
  OperationSnapshot,
  ServiceLineFact,
  StoredOperation,
} from "#application/ports/operation-facts.js";

const LINE_INSTANTS = [
  "openedAt",
  "sentAt",
  "inPreparationAt",
  "readyAt",
  "deliveredAt",
  "requestedAt",
  "chargedAt",
  "releasedAt",
] as const satisfies readonly (keyof ServiceLineFact)[];

const emptySnapshot = (): OperationSnapshot => ({
  lines: [],
  tenders: [],
  cashCounts: [],
  staffHours: [],
  invoices: [],
});

const inPeriod = (instant: string | null, from: string, to: string): boolean =>
  instant !== null && instant >= from && instant < to;

const lineInPeriod = (
  line: ServiceLineFact,
  from: string,
  to: string,
): boolean => LINE_INSTANTS.some((key) => inPeriod(line[key], from, to));

const periodSnapshot = (
  snapshot: OperationSnapshot,
  from: string,
  to: string,
): OperationSnapshot => ({
  lines: snapshot.lines.filter((row) => lineInPeriod(row, from, to)),
  tenders: snapshot.tenders.filter((row) => inPeriod(row.chargedAt, from, to)),
  cashCounts: snapshot.cashCounts.filter((row) =>
    inPeriod(row.closedAt, from, to),
  ),
  staffHours: snapshot.staffHours.filter((row) => inPeriod(row.at, from, to)),
  invoices: snapshot.invoices.filter((row) => inPeriod(row.issuedAt, from, to)),
});

export class InMemoryOperationFacts implements OperationFacts {
  constructor(private readonly stored: readonly StoredOperation[]) {}

  async read(query: OperationFactsQuery): Promise<OperationSnapshot> {
    const found = this.stored.find(
      (row) => row.tenantId === query.tenantId && row.venueId === query.venueId,
    );

    if (!found) {
      return emptySnapshot();
    }

    return structuredClone(
      periodSnapshot(found.snapshot, query.from, query.to),
    );
  }
}
