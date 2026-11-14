import type {
  ApprovedCountFact,
  ApprovedCountFacts,
} from "#application/ports/approved-count-facts.js";
import type {
  LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import {
  MOVEMENT_TYPE,
  type MovementType,
  StockLedger,
} from "#domain/stock-ledger.js";

export interface ListVenueStockFactsQuery {
  tenantId: string;
  venueId: string;
}

export interface VenueStockMovement {
  id: string;
  locationId: string;
  ingredientId: string;
  orderLineId: string;
  kind:
    | "purchase"
    | "transfer_in"
    | "production_output"
    | "sale_consumption"
    | "sale_return"
    | "production_consumption"
    | "waste";
  quantity: number;
  unitCost: number;
  occurredAt: string;
  recipeVersion: number;
}

export interface VenueStockCount {
  locationId: string;
  ingredientId: string;
  quantity: number;
  approvedAt: string;
  averageCostCop: number;
}

export interface VenueStockFacts {
  movements: readonly VenueStockMovement[];
  counts: readonly VenueStockCount[];
}

const chronological = (lines: readonly LedgerLine[]): LedgerLine[] =>
  lines.toSorted((left, right) => {
    const byTime = left.occurredAt.localeCompare(right.occurredAt);

    if (byTime !== 0) {
      return byTime;
    }

    return left.id.localeCompare(right.id);
  });

const reportKind = (type: MovementType): VenueStockMovement["kind"] | null => {
  switch (type) {
    case MOVEMENT_TYPE.PURCHASE:
    case MOVEMENT_TYPE.TRANSFER_IN:
    case MOVEMENT_TYPE.PRODUCTION_OUTPUT:
    case MOVEMENT_TYPE.SALE_CONSUMPTION:
    case MOVEMENT_TYPE.SALE_RETURN:
    case MOVEMENT_TYPE.PRODUCTION_CONSUMPTION:
    case MOVEMENT_TYPE.WASTE:
      return type;
    case MOVEMENT_TYPE.TRANSFER_OUT:
    case MOVEMENT_TYPE.COUNT_ADJUSTMENT:
      return null;
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
};

const replay = (ledger: StockLedger, line: LedgerLine): void => {
  ledger.append({
    id: line.id,
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    unitCost: line.unitCost,
    type: line.type,
    reference: line.reference,
    occurredAt: line.occurredAt,
    ...(line.reversesMovementId === undefined
      ? {}
      : { reversesMovementId: line.reversesMovementId }),
  });
};

const ledgerAt = (
  tenantId: string,
  locationId: string,
  lines: readonly LedgerLine[],
): StockLedger => {
  const ledger = StockLedger.open({ tenantId, locationId });

  for (const line of chronological(lines)) {
    if (line.locationId === locationId) {
      replay(ledger, line);
    }
  }

  return ledger;
};

const closingAverage = (
  tenantId: string,
  lines: readonly LedgerLine[],
  count: ApprovedCountFact,
  ledgers: Map<string, StockLedger>,
): number => {
  const cached = ledgers.get(count.locationId);
  const ledger = cached ?? ledgerAt(tenantId, count.locationId, lines);

  if (!cached) {
    ledgers.set(count.locationId, ledger);
  }

  return ledger.averageCostUntil(count.ingredientId, count.approvedAt);
};

const toMovement = (line: LedgerLine): VenueStockMovement[] => {
  const kind = reportKind(line.type);

  if (kind === null) {
    return [];
  }

  return [
    {
      id: line.id,
      locationId: line.locationId,
      ingredientId: line.ingredientId,
      orderLineId: line.orderLineId,
      kind,
      quantity: line.quantity,
      unitCost: line.unitCost,
      occurredAt: line.occurredAt,
      recipeVersion: line.recipeVersion,
    },
  ];
};

export class ListVenueStockFacts {
  constructor(
    private readonly ledger: StockLedgerRepository,
    private readonly counts: ApprovedCountFacts,
  ) {}

  async execute(query: ListVenueStockFactsQuery): Promise<VenueStockFacts> {
    const [lines, sessions] = await Promise.all([
      this.ledger.listByVenue(query.tenantId, query.venueId),
      this.counts.listByVenue(query.tenantId, query.venueId),
    ]);
    const ledgers = new Map<string, StockLedger>();

    return {
      movements: lines.flatMap(toMovement),
      counts: sessions.map((count) => ({
        locationId: count.locationId,
        ingredientId: count.ingredientId,
        quantity: count.quantity,
        approvedAt: count.approvedAt,
        averageCostCop: closingAverage(query.tenantId, lines, count, ledgers),
      })),
    };
  }
}
