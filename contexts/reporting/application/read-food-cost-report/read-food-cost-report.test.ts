import { expect, it } from "vitest";

import { InMemoryInventoryFacts } from "#adapters/memory/in-memory-inventory-facts.js";
import { InMemoryOperationFacts } from "#adapters/memory/in-memory-operation-facts.js";
import type { ReportCommand } from "#application/authorize-report/authorize-report.js";
import type {
  InventoryMovementLine,
  StoredInventoryFacts,
} from "#application/ports/inventory-facts.js";
import type {
  OperationSnapshot,
  ServiceLineFact,
  StoredOperation,
} from "#application/ports/operation-facts.js";
import {
  REPORT_PERMISSION,
  type ReportAccess,
} from "#application/ports/report-access.js";
import { ReadFoodCostReport } from "#application/read-food-cost-report/read-food-cost-report.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const WEEK_FROM = "2026-11-09T05:00:00.000Z";
const WEEK_TO = "2026-11-16T05:00:00.000Z";
const INSIDE_WEEK = "2026-11-11T18:00:00.000Z";
const MONDAY = "2026-11-09T18:00:00.000Z";
const WEDNESDAY = "2026-11-11T18:00:00.000Z";

const access = (allowed: boolean): ReportAccess => ({
  allows: async (input) => {
    expect(input.permission).toBe(REPORT_PERMISSION.VIEW_COST);
    expect(input.venueId).toBe(VENUE_ID);
    return allowed;
  },
});

const command = (overrides: Partial<ReportCommand> = {}): ReportCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: "identity_user_1",
  role: "site_administrator",
  homeVenueId: VENUE_ID,
  waiterId: null,
  subjectWaiterId: null,
  shiftId: null,
  from: WEEK_FROM,
  to: WEEK_TO,
  ...overrides,
});

const line = (overrides: Partial<ServiceLineFact>): ServiceLineFact => ({
  checkId: "check_1",
  lineId: "line_1",
  tableId: null,
  productId: "burger",
  productName: "Burger",
  stationId: null,
  waiterId: null,
  channel: "waiter",
  quantity: 1,
  grossCop: 0,
  discountCop: 0,
  includedTaxCop: 0,
  tipCop: 0,
  voided: false,
  diners: null,
  openedAt: INSIDE_WEEK,
  sentAt: INSIDE_WEEK,
  inPreparationAt: INSIDE_WEEK,
  readyAt: INSIDE_WEEK,
  deliveredAt: INSIDE_WEEK,
  requestedAt: INSIDE_WEEK,
  chargedAt: INSIDE_WEEK,
  releasedAt: INSIDE_WEEK,
  ...overrides,
});

const movement = (
  overrides: Partial<InventoryMovementLine> & Pick<InventoryMovementLine, "id">,
): InventoryMovementLine => ({
  locationId: "cooler",
  ingredientId: "beef",
  orderLineId: "line_burger",
  kind: "sale_consumption",
  quantity: 1,
  unitCost: 1,
  occurredAt: INSIDE_WEEK,
  recipeVersion: 2,
  ...overrides,
});

const operations = (lines: ServiceLineFact[]): StoredOperation => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  snapshot: {
    lines,
    tenders: [],
    cashCounts: [],
    staffHours: [],
    invoices: [],
  } satisfies OperationSnapshot,
});

const inventory = (
  movements: InventoryMovementLine[],
): StoredInventoryFacts => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  movements,
  counts: [],
});

const reader = (
  storedOperations: readonly StoredOperation[],
  storedInventory: readonly StoredInventoryFacts[],
  allowed = true,
) =>
  new ReadFoodCostReport(
    access(allowed),
    new InMemoryOperationFacts(storedOperations),
    new InMemoryInventoryFacts(storedInventory),
  );

it("given an administrator of another venue, when food cost is read, then access is denied", async () => {
  const result = await reader([], []).execute(
    command({ venueId: OTHER_VENUE_ID }),
  );

  expect(result).toEqual({ outcome: "denied", reason: "other_venue" });
});

it("given a waiter with view-cost, when food cost is read, then no cost data is returned", async () => {
  const result = await reader([], []).execute(
    command({ role: "waiter", waiterId: "identity_waiter_1" }),
  );

  expect(result).toEqual({ outcome: "denied", reason: "missing_permission" });
});

it("given a reader without inventory.view-cost, when food cost is read, then access is denied", async () => {
  const result = await reader([], [], false).execute(command());

  expect(result).toEqual({ outcome: "denied", reason: "missing_permission" });
});

it("given two charged lines of one product, when food cost is read, then that product id is a single row and each recipe version is kept", async () => {
  const result = await reader(
    [
      operations([
        line({
          lineId: "line_monday",
          chargedAt: MONDAY,
          openedAt: MONDAY,
          sentAt: MONDAY,
          inPreparationAt: MONDAY,
          readyAt: MONDAY,
          deliveredAt: MONDAY,
          requestedAt: MONDAY,
          releasedAt: MONDAY,
          grossCop: 4_000_000,
        }),
        line({
          lineId: "line_wednesday",
          chargedAt: WEDNESDAY,
          openedAt: WEDNESDAY,
          sentAt: WEDNESDAY,
          inPreparationAt: WEDNESDAY,
          readyAt: WEDNESDAY,
          deliveredAt: WEDNESDAY,
          requestedAt: WEDNESDAY,
          releasedAt: WEDNESDAY,
          grossCop: 6_000_000,
        }),
      ]),
    ],
    [
      inventory([
        movement({
          id: "movement_monday",
          orderLineId: "line_monday",
          quantity: 100,
          unitCost: 10_000,
          occurredAt: MONDAY,
          recipeVersion: 1,
        }),
        movement({
          id: "movement_wednesday",
          orderLineId: "line_wednesday",
          quantity: 110,
          unitCost: 20_000,
          occurredAt: WEDNESDAY,
          recipeVersion: 4,
        }),
      ]),
    ],
  ).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: {
      ratio: 3_200_000 / 10_000_000,
      theoreticalCop: 3_200_000,
      netSalesCop: 10_000_000,
      uncostedProductIds: [],
      products: [
        {
          productId: "burger",
          recipeVersions: [
            { productId: "burger", occurredAt: MONDAY, recipeVersion: 1 },
            {
              productId: "burger",
              occurredAt: WEDNESDAY,
              recipeVersion: 4,
            },
          ],
        },
      ],
    },
  });
});

it("given a sold line with no consumption and a repeated uncosted product, when food cost is read, then that line is off both sides and the product id is listed once", async () => {
  const result = await reader(
    [
      operations([
        line({
          lineId: "line_burger",
          grossCop: 8_000_000,
        }),
        line({
          lineId: "line_soda",
          checkId: "check_soda",
          productId: "soda",
          productName: "Soda",
          grossCop: 2_000_000,
        }),
        line({
          lineId: "line_soda_again",
          checkId: "check_soda_2",
          productId: "soda",
          productName: "Soda",
          grossCop: 500_000,
        }),
        line({
          lineId: "line_void",
          productId: "water",
          productName: "Water",
          grossCop: 9_000_000,
          voided: true,
        }),
      ]),
    ],
    [
      inventory([
        movement({
          id: "movement_burger",
          orderLineId: "line_burger",
          quantity: 100,
          unitCost: 24_000,
          recipeVersion: 1,
        }),
      ]),
    ],
  ).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: {
      ratio: 2_400_000 / 8_000_000,
      theoreticalCop: 2_400_000,
      netSalesCop: 8_000_000,
      uncostedProductIds: ["soda"],
      products: [
        {
          productId: "burger",
          recipeVersions: [
            {
              productId: "burger",
              occurredAt: INSIDE_WEEK,
              recipeVersion: 1,
            },
          ],
        },
      ],
    },
  });
});

it("given consumption and a sale return, when food cost is read, then cost is abs(quantity) times unit cost net of the return and a repeated movement id counts once", async () => {
  const result = await reader(
    [
      operations([
        line({
          lineId: "line_burger",
          grossCop: 10_000_000,
        }),
        line({
          lineId: "line_late",
          chargedAt: WEEK_TO,
          grossCop: 9_000_000,
        }),
      ]),
    ],
    [
      inventory([
        movement({
          id: "movement_consumption",
          orderLineId: "line_burger",
          quantity: -350,
          unitCost: 10_000,
          recipeVersion: 2,
        }),
        movement({
          id: "movement_consumption",
          orderLineId: "line_burger",
          quantity: -9_999,
          unitCost: 10_000,
          recipeVersion: 2,
        }),
        movement({
          id: "movement_return",
          orderLineId: "line_burger",
          kind: "sale_return",
          quantity: -30,
          unitCost: 10_000,
          recipeVersion: 2,
        }),
        movement({
          id: "movement_late",
          orderLineId: "line_burger",
          quantity: -1,
          unitCost: 9_000_000,
          occurredAt: WEEK_TO,
          recipeVersion: 9,
        }),
      ]),
    ],
  ).execute(command());

  expect(result).toEqual({
    outcome: "ready",
    report: {
      ratio: 3_200_000 / 10_000_000,
      theoreticalCop: 3_200_000,
      netSalesCop: 10_000_000,
      uncostedProductIds: [],
      products: [
        {
          productId: "burger",
          recipeVersions: [
            {
              productId: "burger",
              occurredAt: INSIDE_WEEK,
              recipeVersion: 2,
            },
            {
              productId: "burger",
              occurredAt: INSIDE_WEEK,
              recipeVersion: 2,
            },
          ],
        },
      ],
    },
  });
});
