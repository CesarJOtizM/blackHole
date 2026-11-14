import { expect, it } from "vitest";

import { InMemoryProducibleQuantityRepository } from "#adapters/memory/in-memory-producible-quantity-repository.js";
import type {
  ProducibleProduct,
  ProducibleProjection,
  ProducibleQuantityRepository,
} from "#application/ports/producible-quantity-repository.js";
import type { AvailabilityState } from "#domain/producible-quantity.js";

const TENANT_A = "organization_tenant_1";
const TENANT_B = "organization_tenant_2";
const SITE_ID = "organization_venue_1";
const BEEF_ID = "ingredient_beef";
const BUN_ID = "ingredient_bun";
const CHEESE_ID = "ingredient_cheese";
const LEMON_ID = "ingredient_lemon";

const BURGER: ProducibleProduct = {
  productId: "product_burger",
  variantId: null,
};

const SANDWICH: ProducibleProduct = {
  productId: "product_sandwich",
  variantId: null,
};

export interface StockMovementRow {
  tenantId: string;
}

export interface ProducibleQuantityContractSubject {
  repository: ProducibleQuantityRepository;
  stockMovements(tenantId: string): Promise<readonly StockMovementRow[]>;
}

const projection = (
  product: ProducibleProduct,
  pointUnits: number,
  replenishmentUnits: number,
  state: AvailabilityState,
  limitingIngredientIds: readonly string[],
): ProducibleProjection => ({
  siteId: SITE_ID,
  productId: product.productId,
  variantId: product.variantId,
  pointUnits,
  replenishmentUnits,
  limitingIngredientIds,
  state,
});

export function producibleQuantityRepositoryContract(
  open: () =>
    | ProducibleQuantityContractSubject
    | Promise<ProducibleQuantityContractSubject>,
): void {
  it("given burgers and sandwiches share beef, when the burger explode index moves to cheese, then beef keeps the sandwich and cheese lists the burger", async () => {
    const { repository } = await open();

    await repository.replaceIndex(TENANT_A, SITE_ID, BURGER, [BEEF_ID, BUN_ID]);
    await repository.replaceIndex(TENANT_A, SITE_ID, SANDWICH, [BEEF_ID]);

    expect(await repository.productsFor(TENANT_A, SITE_ID, BEEF_ID)).toEqual([
      BURGER,
      SANDWICH,
    ]);
    expect(await repository.productsFor(TENANT_A, SITE_ID, BUN_ID)).toEqual([
      BURGER,
    ]);
    expect(await repository.productsFor(TENANT_A, SITE_ID, LEMON_ID)).toEqual(
      [],
    );

    await repository.replaceIndex(TENANT_A, SITE_ID, BURGER, [CHEESE_ID]);

    expect(await repository.productsFor(TENANT_A, SITE_ID, BEEF_ID)).toEqual([
      SANDWICH,
    ]);
    expect(await repository.productsFor(TENANT_A, SITE_ID, BUN_ID)).toEqual([]);
    expect(await repository.productsFor(TENANT_A, SITE_ID, CHEESE_ID)).toEqual([
      BURGER,
    ]);
    expect(await repository.productsFor(TENANT_A, SITE_ID, LEMON_ID)).toEqual(
      [],
    );
  });

  it("given tenant A stored an index and a projection, when tenant B reads them, then those rows stay hidden", async () => {
    const { repository } = await open();
    const stored = projection(BURGER, 12, 52, "available", [BUN_ID]);
    const other = projection(SANDWICH, 3, 3, "low_units", [BEEF_ID]);

    await repository.replaceIndex(TENANT_A, SITE_ID, BURGER, [BEEF_ID, BUN_ID]);
    await repository.save(TENANT_A, stored);
    await repository.replaceIndex(TENANT_B, SITE_ID, SANDWICH, [BEEF_ID]);
    await repository.save(TENANT_B, other);

    expect(await repository.productsFor(TENANT_B, SITE_ID, BUN_ID)).toEqual([]);
    expect(await repository.find(TENANT_B, SITE_ID, BURGER)).toBeNull();
    expect(await repository.productsFor(TENANT_A, SITE_ID, BEEF_ID)).toEqual([
      BURGER,
    ]);
    expect(await repository.find(TENANT_A, SITE_ID, BURGER)).toEqual(stored);
    expect(await repository.productsFor(TENANT_B, SITE_ID, BEEF_ID)).toEqual([
      SANDWICH,
    ]);
    expect(await repository.find(TENANT_B, SITE_ID, SANDWICH)).toEqual(other);
    expect(await repository.find(TENANT_A, SITE_ID, SANDWICH)).toBeNull();
  });

  it("given an explode index and a saved projection, when stock movements are read, then nothing was inserted", async () => {
    const { repository, stockMovements } = await open();

    await repository.replaceIndex(TENANT_A, SITE_ID, BURGER, [BEEF_ID, BUN_ID]);
    await repository.save(
      TENANT_A,
      projection(BURGER, 12, 52, "available", [BUN_ID]),
    );
    await repository.productsFor(TENANT_A, SITE_ID, BEEF_ID);
    await repository.find(TENANT_A, SITE_ID, BURGER);

    expect(await stockMovements(TENANT_A)).toEqual([]);
    expect(await stockMovements(TENANT_B)).toEqual([]);
  });
}

const testPath = (expect.getState().testPath ?? "").replaceAll("\\", "/");
const importedByPostgresContract = testPath.endsWith(
  "drizzle-producible-quantity-repository.contract.test.ts",
);

if (!importedByPostgresContract) {
  producibleQuantityRepositoryContract(() => {
    const repository = new InMemoryProducibleQuantityRepository();

    return {
      repository,
      stockMovements: async (tenantId) => repository.stockMovements(tenantId),
    };
  });
}
