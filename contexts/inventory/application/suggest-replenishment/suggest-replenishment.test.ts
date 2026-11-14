import { expect, it } from "vitest";

import {
  type StockLevel,
  StockLevelRepository,
} from "#application/ports/stock-level-repository.js";
import {
  OnHandStock,
  SuggestReplenishment,
} from "#application/suggest-replenishment/suggest-replenishment.js";

const TENANT_ID = "organization_tenant";
const POINT_ID = "location_point";
const BEEF_ID = "ingredient_beef";

const stockKey = (
  tenantId: string,
  locationId: string,
  ingredientId: string,
): string => `${tenantId}:${locationId}:${ingredientId}`;

class MemoryStockLevels extends StockLevelRepository {
  private readonly levels = new Map<string, StockLevel>();
  readonly saved: StockLevel[] = [];

  put(tenantId: string, level: StockLevel): void {
    this.levels.set(
      stockKey(tenantId, level.locationId, level.ingredientId),
      level,
    );
  }

  find(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<StockLevel | null> {
    return Promise.resolve(
      this.levels.get(stockKey(tenantId, locationId, ingredientId)) ?? null,
    );
  }

  save(_tenantId: string, level: StockLevel): Promise<void> {
    this.saved.push(level);
    return Promise.resolve();
  }
}

class MemoryOnHand extends OnHandStock {
  private readonly balances = new Map<string, number>();
  readonly movements: readonly never[] = [];
  readonly requests: readonly never[] = [];

  put(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    onHand: number,
  ): void {
    this.balances.set(stockKey(tenantId, locationId, ingredientId), onHand);
  }

  read(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<{ onHand: number } | null> {
    const onHand = this.balances.get(
      stockKey(tenantId, locationId, ingredientId),
    );
    return Promise.resolve(onHand === undefined ? null : { onHand });
  }
}

const harness = () => {
  const levels = new MemoryStockLevels();
  const stock = new MemoryOnHand();
  const suggest = new SuggestReplenishment(levels, stock);

  return { levels, stock, suggest };
};

const beefAt = (
  levels: MemoryStockLevels,
  stock: MemoryOnHand,
  onHand: number,
  minimum = 5,
  maximum = 20,
) => {
  levels.put(TENANT_ID, {
    locationId: POINT_ID,
    ingredientId: BEEF_ID,
    minimum,
    maximum,
  });
  stock.put(TENANT_ID, POINT_ID, BEEF_ID, onHand);
};

const suggestBeef = (suggest: SuggestReplenishment) =>
  suggest.execute({
    tenantId: TENANT_ID,
    locationId: POINT_ID,
    ingredientId: BEEF_ID,
  });

it("given minimum 5, maximum 20 and on-hand 4, when replenishment is suggested, then the suggestion is 16 and no stock movement or transfer is stored", async () => {
  const { levels, stock, suggest } = harness();
  beefAt(levels, stock, 4);

  const suggestion = await suggestBeef(suggest);

  expect(suggestion).toBe(16);
  expect(levels.saved).toEqual([]);
  expect(stock.movements).toEqual([]);
  expect(stock.requests).toEqual([]);
});

it("given on-hand at or above the minimum, when replenishment is suggested, then nothing is suggested", async () => {
  const { levels, stock, suggest } = harness();
  beefAt(levels, stock, 5);

  expect(await suggestBeef(suggest)).toBeUndefined();

  stock.put(TENANT_ID, POINT_ID, BEEF_ID, 20);

  expect(await suggestBeef(suggest)).toBeUndefined();
  expect(levels.saved).toEqual([]);
  expect(stock.movements).toEqual([]);
  expect(stock.requests).toEqual([]);
});

it("given an ingredient without levels, when its balance is read, then nothing is suggested", async () => {
  const { levels, stock, suggest } = harness();
  stock.put(TENANT_ID, POINT_ID, BEEF_ID, 4);

  expect(await suggestBeef(suggest)).toBeUndefined();
  expect(levels.saved).toEqual([]);
  expect(stock.movements).toEqual([]);
  expect(stock.requests).toEqual([]);
});
