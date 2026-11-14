import { expect, it } from "vitest";

import { ListVenueStockFacts } from "#application/list-venue-stock-facts/list-venue-stock-facts.js";
import {
  type ApprovedCountFact,
  ApprovedCountFacts,
} from "#application/ports/approved-count-facts.js";
import {
  type AppendStock,
  CONSUMPTION_ROLE,
  type LedgerLine,
  StockLedgerRepository,
} from "#application/ports/stock-ledger-repository.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const COOLER_ID = "location_cooler";
const DRY_ID = "location_dry";
const BEEF_ID = "ingredient_beef";
const OPENING_AT = "2026-11-01T05:00:00.000Z";
const PURCHASE_AT = "2026-11-04T15:00:00.000Z";
const CLOSING_AT = "2026-11-08T05:00:00.000Z";
const AFTER_CLOSE_AT = "2026-11-09T05:00:00.000Z";

interface StoredCount extends ApprovedCountFact {
  tenantId: string;
  venueId: string;
}

class MemoryLedger extends StockLedgerRepository {
  readonly queries: { tenantId: string; venueId: string }[] = [];
  appends = 0;

  constructor(private readonly lines: readonly LedgerLine[]) {
    super();
  }

  override async findLine(): Promise<readonly LedgerLine[]> {
    return [];
  }

  override async balance(): Promise<number> {
    return 0;
  }

  override async hasOpenAlert(): Promise<boolean> {
    return false;
  }

  override async append(_input: AppendStock): Promise<void> {
    this.appends += 1;
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly LedgerLine[]> {
    this.queries.push({ tenantId, venueId });

    return this.lines.filter(
      (line) => line.tenantId === tenantId && line.venueId === venueId,
    );
  }
}

class SessionCounts extends ApprovedCountFacts {
  readonly queries: { tenantId: string; venueId: string }[] = [];

  constructor(private readonly rows: readonly StoredCount[]) {
    super();
  }

  override async listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ApprovedCountFact[]> {
    this.queries.push({ tenantId, venueId });

    return this.rows
      .filter((row) => row.tenantId === tenantId && row.venueId === venueId)
      .map((row) => ({
        locationId: row.locationId,
        ingredientId: row.ingredientId,
        quantity: row.quantity,
        approvedAt: row.approvedAt,
      }));
  }
}

const purchase = (
  overrides: Partial<LedgerLine> & Pick<LedgerLine, "id">,
): LedgerLine => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: COOLER_ID,
  ingredientId: BEEF_ID,
  quantity: 10,
  unitCost: 1_500,
  type: MOVEMENT_TYPE.PURCHASE,
  reference: "receipt_beef",
  occurredAt: PURCHASE_AT,
  orderLineId: "receipt_beef",
  role: CONSUMPTION_ROLE.CONSUMPTION,
  recipeVersion: 0,
  reason: null,
  actorId: null,
  ...overrides,
});

const count = (overrides: Partial<StoredCount> = {}): StoredCount => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  locationId: COOLER_ID,
  ingredientId: BEEF_ID,
  quantity: 7,
  approvedAt: CLOSING_AT,
  ...overrides,
});

const list = (
  ledger: MemoryLedger,
  counts: ApprovedCountFacts,
): Promise<Awaited<ReturnType<ListVenueStockFacts["execute"]>>> =>
  new ListVenueStockFacts(ledger, counts).execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
  });

it("given lines for another tenant and another venue, when venue stock facts are listed, then only this tenant and venue are returned and nothing is appended", async () => {
  const ledger = new MemoryLedger([
    purchase({ id: "movement_beef" }),
    purchase({
      id: "movement_other_tenant",
      tenantId: OTHER_TENANT_ID,
    }),
    purchase({
      id: "movement_other_venue",
      venueId: OTHER_VENUE_ID,
    }),
  ]);
  const counts = new SessionCounts([
    count({ quantity: 7 }),
    count({
      tenantId: OTHER_TENANT_ID,
      ingredientId: "ingredient_hidden",
      quantity: 99,
    }),
  ]);

  const result = await list(ledger, counts);

  expect(ledger.queries).toEqual([{ tenantId: TENANT_ID, venueId: VENUE_ID }]);
  expect(counts.queries).toEqual([{ tenantId: TENANT_ID, venueId: VENUE_ID }]);
  expect(ledger.appends).toBe(0);
  expect(result.movements.map((movement) => movement.id)).toEqual([
    "movement_beef",
  ]);
  expect(result.counts.map((row) => row.ingredientId)).toEqual([BEEF_ID]);
});

it("given a purchase before the closing count and another after it, when venue stock facts are listed, then the closing count carries the average cost at closing", async () => {
  const ledger = new MemoryLedger([
    purchase({
      id: "movement_before",
      occurredAt: PURCHASE_AT,
      unitCost: 1_500,
    }),
    purchase({
      id: "movement_other_location",
      locationId: DRY_ID,
      unitCost: 9_000,
    }),
    purchase({
      id: "movement_after_close",
      occurredAt: AFTER_CLOSE_AT,
      unitCost: 4_500,
    }),
  ]);
  const counts = new SessionCounts([
    count({ quantity: 12, approvedAt: OPENING_AT }),
    count({ quantity: 7, approvedAt: CLOSING_AT }),
  ]);

  const result = await list(ledger, counts);

  expect(ledger.appends).toBe(0);
  expect(result.counts).toEqual([
    {
      locationId: COOLER_ID,
      ingredientId: BEEF_ID,
      quantity: 12,
      approvedAt: OPENING_AT,
      averageCostCop: 0,
    },
    {
      locationId: COOLER_ID,
      ingredientId: BEEF_ID,
      quantity: 7,
      approvedAt: CLOSING_AT,
      averageCostCop: 1_500,
    },
  ]);
  expect(result.movements.map((movement) => movement.id)).toEqual([
    "movement_before",
    "movement_other_location",
    "movement_after_close",
  ]);
});

it("given an empty approved-count session, when venue stock facts are listed, then the counts stay empty", async () => {
  const ledger = new MemoryLedger([purchase({ id: "movement_beef" })]);

  const result = await list(ledger, new ApprovedCountFacts());

  expect(result.counts).toEqual([]);
  expect(result.movements).toEqual([
    {
      id: "movement_beef",
      locationId: COOLER_ID,
      ingredientId: BEEF_ID,
      orderLineId: "receipt_beef",
      kind: "purchase",
      quantity: 10,
      unitCost: 1_500,
      occurredAt: PURCHASE_AT,
      recipeVersion: 0,
    },
  ]);
  expect(ledger.appends).toBe(0);
});
