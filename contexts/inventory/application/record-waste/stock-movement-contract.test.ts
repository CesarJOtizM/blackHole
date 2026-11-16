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
      orderLineId: string;
      recipeVersion: number;
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

it("given operational waste and a count adjustment, when StockMoved parses them, then both roles stay valid with recipeVersion 0 and the document id beside consumption and reversal", async () => {
  const loaded = (await import(
    pathToFileURL(contractPath).href
  )) as StockContract;
  const documentId = "document_milk_shortage";
  const movement = (
    role: string,
    movementType: string,
    recipeVersion: number,
  ) => ({
    type: "StockMoved",
    movementId: `movement_${documentId}_${role}`,
    tenantId: "organization_tenant_1",
    venueId: "organization_venue_1",
    locationId: "location_point_of_sale",
    ingredientId: "ingredient_milk",
    quantity: -600_000,
    unitCost: 1_500,
    movementType,
    orderLineId: documentId,
    recipeVersion,
    occurredAt: "2026-11-13T18:00:00.000Z",
    role,
  });

  const consumption = loaded.stockMoved.parse(
    movement("consumption", "sale_consumption", 0),
  );
  const reversal = loaded.stockMoved.parse(movement("reversal", "waste", 0));
  const operationalWaste = loaded.stockMoved.parse(
    movement("operational_waste", "waste", 0),
  );
  const countAdjustment = loaded.stockMoved.parse(
    movement("count_adjustment", "count_adjustment", 0),
  );

  expect(consumption).toMatchObject({
    role: "consumption",
    orderLineId: documentId,
    recipeVersion: 0,
  });
  expect(reversal).toMatchObject({
    role: "reversal",
    orderLineId: documentId,
    recipeVersion: 0,
  });
  expect(operationalWaste).toMatchObject({
    role: "operational_waste",
    movementType: "waste",
    orderLineId: documentId,
    recipeVersion: 0,
  });
  expect(countAdjustment).toMatchObject({
    role: "count_adjustment",
    movementType: "count_adjustment",
    orderLineId: documentId,
    recipeVersion: 0,
  });
  expect(
    loaded.stockMoved.safeParse({
      ...movement("operational_waste", "waste", 0),
      extra: true,
    }).success,
  ).toBe(false);
  expect(
    loaded.stockMoved.safeParse(movement("sale_void", "waste", 0)).success,
  ).toBe(false);
});
