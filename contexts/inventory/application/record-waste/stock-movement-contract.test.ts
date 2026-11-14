import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = join(
  here,
  "../../../../shared/contracts/stock-movement.ts",
);
const indexPath = join(here, "../../../../shared/contracts/index.ts");
const ledgerPath = join(here, "../../domain/stock-ledger.ts");

interface StockContract {
  stockMoved: {
    parse: (input: unknown) => {
      type: string;
      quantity: number;
      movementType: string;
      role: string;
    };
    safeParse: (input: unknown) => { success: boolean };
  };
  negativeStockOpened: {
    parse: (input: unknown) => { type: string; balance: number };
    safeParse: (input: unknown) => { success: boolean };
  };
}

it("given a stock movement and an opened shortage, when the contracts parse them, then StockMoved and NegativeStockOpened keep the scaled integers", async () => {
  const loaded = (await import(
    pathToFileURL(contractPath).href
  )) as StockContract;
  const index = readFileSync(indexPath, "utf8");
  const ledger = readFileSync(ledgerPath, "utf8");

  const moved = loaded.stockMoved.parse({
    type: "StockMoved",
    movementId: "movement_order_line_burger_consumption_ingredient_beef",
    tenantId: "organization_tenant_1",
    venueId: "organization_venue_1",
    locationId: "location_point_of_sale",
    ingredientId: "ingredient_beef",
    quantity: -300_000,
    unitCost: 180_000,
    movementType: "sale_consumption",
    orderLineId: "order_line_burger",
    recipeVersion: 4,
    occurredAt: "2026-11-13T18:00:00.000Z",
    role: "consumption",
  });
  const opened = loaded.negativeStockOpened.parse({
    type: "NegativeStockOpened",
    tenantId: "organization_tenant_1",
    venueId: "organization_venue_1",
    locationId: "location_point_of_sale",
    ingredientId: "ingredient_beef",
    balance: -200_000,
    occurredAt: "2026-11-13T18:00:00.000Z",
  });

  expect(moved).toMatchObject({
    type: "StockMoved",
    quantity: -300_000,
    movementType: "sale_consumption",
    role: "consumption",
  });
  expect(opened).toEqual({
    type: "NegativeStockOpened",
    tenantId: "organization_tenant_1",
    venueId: "organization_venue_1",
    locationId: "location_point_of_sale",
    ingredientId: "ingredient_beef",
    balance: -200_000,
    occurredAt: "2026-11-13T18:00:00.000Z",
  });
  expect(loaded.stockMoved.safeParse({ type: "StockMoved" }).success).toBe(
    false,
  );
  expect(
    loaded.negativeStockOpened.safeParse({ ...opened, extra: true }).success,
  ).toBe(false);
  expect(index).toContain("stockMoved");
  expect(index).toContain("negativeStockOpened");
  expect(ledger.includes("zod")).toBe(false);
});
