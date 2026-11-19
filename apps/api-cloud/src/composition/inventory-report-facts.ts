import { DrizzleStockLedgerRepository } from "@blackhole/inventory/adapters/postgres/drizzle-stock-ledger-repository";
import { ListVenueStockFacts } from "@blackhole/inventory/application/entry-port";
import type { StockLedgerRepository } from "@blackhole/inventory/application/ports/stock-ledger-repository";

type InventoryDatabase = ConstructorParameters<
  typeof DrizzleStockLedgerRepository
>[0];

class EmptyApprovedCounts {
  listByVenue(): Promise<readonly []> {
    return Promise.resolve([]);
  }
}

const inPeriod = (instant: string, from: string, to: string): boolean =>
  instant >= from && instant < to;

export interface InventoryReportQuery {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
}

export interface InventoryReportMovement {
  id: string;
  locationId: string;
  ingredientId: string;
  orderLineId: string | null;
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
  recipeVersion: number | null;
}

export interface InventoryReportCount {
  locationId: string;
  ingredientId: string;
  quantity: number;
  approvedAt: string;
  averageCostCop: number;
}

export interface InventoryReportSnapshot {
  movements: InventoryReportMovement[];
  counts: InventoryReportCount[];
}

export class InventoryReportFacts {
  private readonly list: ListVenueStockFacts;

  constructor(ledger: StockLedgerRepository) {
    this.list = new ListVenueStockFacts(ledger, new EmptyApprovedCounts());
  }

  async read(query: InventoryReportQuery): Promise<InventoryReportSnapshot> {
    const listed = await this.list.execute({
      tenantId: query.tenantId,
      venueId: query.venueId,
    });

    return {
      movements: listed.movements.flatMap((row) =>
        inPeriod(row.occurredAt, query.from, query.to)
          ? [
              {
                id: row.id,
                locationId: row.locationId,
                ingredientId: row.ingredientId,
                orderLineId: row.orderLineId,
                kind: row.kind,
                quantity: row.quantity,
                unitCost: row.unitCost,
                occurredAt: row.occurredAt,
                recipeVersion: row.recipeVersion,
              },
            ]
          : [],
      ),
      counts: listed.counts.flatMap((row) =>
        inPeriod(row.approvedAt, query.from, query.to)
          ? [
              {
                locationId: row.locationId,
                ingredientId: row.ingredientId,
                quantity: row.quantity,
                approvedAt: row.approvedAt,
                averageCostCop: row.averageCostCop,
              },
            ]
          : [],
      ),
    };
  }
}

export const createInventoryReportFacts = (
  database: InventoryDatabase | undefined,
  ledger: StockLedgerRepository,
): InventoryReportFacts =>
  new InventoryReportFacts(
    database === undefined
      ? ledger
      : new DrizzleStockLedgerRepository(database),
  );
