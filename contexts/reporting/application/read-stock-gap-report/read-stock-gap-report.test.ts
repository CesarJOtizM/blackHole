import { expect, it } from "vitest";

import { InMemoryInventoryFacts } from "#adapters/memory/in-memory-inventory-facts.js";
import type { ReportCommand } from "#application/authorize-report/authorize-report.js";
import type {
  InventoryCountFact,
  InventoryMovementLine,
  StoredInventoryFacts,
} from "#application/ports/inventory-facts.js";
import {
  REPORT_PERMISSION,
  type ReportAccess,
} from "#application/ports/report-access.js";
import { ReadStockGapReport } from "#application/read-stock-gap-report/read-stock-gap-report.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const FROM = "2026-10-31T00:00:00.000Z";
const TO = "2026-11-09T05:00:00.000Z";
const COUNT_OPEN = "2026-11-01T05:00:00.000Z";
const COUNT_CLOSE = "2026-11-08T05:00:00.000Z";
const BETWEEN_COUNTS = "2026-11-04T15:00:00.000Z";

const access: ReportAccess = {
  allows: async (input) => {
    expect(input.permission).toBe(REPORT_PERMISSION.VIEW_COST);
    return true;
  },
};

const command = (overrides: Partial<ReportCommand> = {}): ReportCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: "identity_user_1",
  role: "site_administrator",
  homeVenueId: VENUE_ID,
  waiterId: null,
  subjectWaiterId: null,
  shiftId: null,
  from: FROM,
  to: TO,
  ...overrides,
});

const count = (
  overrides: Partial<InventoryCountFact> = {},
): InventoryCountFact => ({
  locationId: "cooler",
  ingredientId: "beef",
  quantity: 100,
  approvedAt: COUNT_OPEN,
  averageCostCop: 500,
  ...overrides,
});

const movement = (
  overrides: Partial<InventoryMovementLine> & Pick<InventoryMovementLine, "id">,
): InventoryMovementLine => ({
  locationId: "cooler",
  ingredientId: "beef",
  orderLineId: null,
  kind: "purchase",
  quantity: 1,
  unitCost: 0,
  occurredAt: BETWEEN_COUNTS,
  recipeVersion: null,
  ...overrides,
});

const beefMovements = (): InventoryMovementLine[] => [
  movement({
    id: "movement_before",
    quantity: 500,
    occurredAt: "2026-10-31T05:00:00.000Z",
  }),
  movement({ id: "movement_purchase", quantity: 20 }),
  movement({ id: "movement_transfer", kind: "transfer_in", quantity: 10 }),
  movement({
    id: "movement_output",
    kind: "production_output",
    quantity: 3,
  }),
  movement({
    id: "movement_sale",
    kind: "sale_consumption",
    quantity: 35,
  }),
  movement({ id: "movement_return", kind: "sale_return", quantity: 5 }),
  movement({
    id: "movement_production",
    kind: "production_consumption",
    quantity: 10,
  }),
  movement({ id: "movement_waste", kind: "waste", quantity: 2 }),
  movement({
    id: "movement_after_close",
    quantity: 1_000,
    occurredAt: COUNT_CLOSE,
  }),
];

const closedCounts = (): InventoryCountFact[] => [
  count(),
  count({ quantity: 90, approvedAt: COUNT_CLOSE, averageCostCop: 1_000 }),
];

const stored = (
  movements: readonly InventoryMovementLine[],
  counts: readonly InventoryCountFact[],
): StoredInventoryFacts => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  movements,
  counts,
});

const readyRow = {
  locationId: "cooler",
  ingredientId: "beef",
  theoreticalQuantity: 40,
  actualQuantity: 43,
  differenceQuantity: 3,
  wasteQuantity: 2,
  averageCostCop: 1_000,
  differenceCop: 3_000,
};

const reader = (facts: InMemoryInventoryFacts) =>
  new ReadStockGapReport(access, facts);

it("given approved counts and movements between them, when the stock gap is read, then 40 against 43 is 3 kg at the closing average cost and waste is its own column", async () => {
  const result = await reader(
    new InMemoryInventoryFacts([stored(beefMovements(), closedCounts())]),
  ).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: { status: "ready", rows: [readyRow] },
  });
});

it("given only an opening count, when the stock gap is read, then the period is pending and not a zero difference", async () => {
  const result = await reader(
    new InMemoryInventoryFacts([
      stored([movement({ id: "movement_purchase", quantity: 20 })], [count()]),
    ]),
  ).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: { status: "pending" },
  });
});

it("given one ingredient ready and another with only an opening count, when the stock gap is read, then pending replaces the rows", async () => {
  const result = await reader(
    new InMemoryInventoryFacts([
      stored(beefMovements(), [
        ...closedCounts(),
        count({
          ingredientId: "milk",
          quantity: 8,
          averageCostCop: 700,
        }),
      ]),
    ]),
  ).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: { status: "pending" },
  });
});

it("given the same movement id twice, when the stock gap is read, then that id counts once", async () => {
  const result = await reader(
    new InMemoryInventoryFacts([
      stored(
        [
          ...beefMovements(),
          movement({ id: "movement_purchase", quantity: 20 }),
        ],
        closedCounts(),
      ),
    ]),
  ).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: { status: "ready", rows: [readyRow] },
  });
});

it("given stored movements, when the stock gap is read, then nothing is appended", async () => {
  const movements = beefMovements();
  const counts = closedCounts();
  const facts = new InMemoryInventoryFacts([stored(movements, counts)]);

  await reader(facts).execute(command());

  expect(movements).toHaveLength(9);
  expect(counts).toHaveLength(2);
  expect("append" in facts).toBe(false);
  expect("write" in facts).toBe(false);
});
