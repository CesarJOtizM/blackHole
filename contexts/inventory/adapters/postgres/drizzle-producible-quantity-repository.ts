import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  producibleIngredientIndex,
  producibleLimitingIngredients,
  producibleQuantities,
} from "#adapters/postgres/schema.js";
import {
  type ProducibleProduct,
  type ProducibleProjection,
  ProducibleQuantityRepository,
} from "#application/ports/producible-quantity-repository.js";
import type { AvailabilityState } from "#domain/producible-quantity.js";

const NO_VARIANT = "";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const variantKey = (variantId: string | null): string =>
  variantId ?? NO_VARIANT;

const variantIdOf = (stored: string): string | null =>
  stored === NO_VARIANT ? null : stored;

const asNumber = (value: number | string): number => Number(value);

const stateOf = (value: string): AvailabilityState => {
  if (value === "available" || value === "low_units" || value === "sold_out") {
    return value;
  }

  throw new Error("The producible quantity state is unknown.");
};

const productWhere = (
  tenantId: string,
  siteId: string,
  product: ProducibleProduct,
) =>
  and(
    eq(producibleQuantities.tenantId, tenantId),
    eq(producibleQuantities.siteId, siteId),
    eq(producibleQuantities.productId, product.productId),
    eq(producibleQuantities.variantId, variantKey(product.variantId)),
  );

export class DrizzleProducibleQuantityRepository extends ProducibleQuantityRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async productsFor(
    tenantId: string,
    siteId: string,
    ingredientId: string,
  ): Promise<readonly ProducibleProduct[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          productId: producibleIngredientIndex.productId,
          variantId: producibleIngredientIndex.variantId,
        })
        .from(producibleIngredientIndex)
        .where(
          and(
            eq(producibleIngredientIndex.tenantId, tenantId),
            eq(producibleIngredientIndex.siteId, siteId),
            eq(producibleIngredientIndex.ingredientId, ingredientId),
          ),
        )
        .orderBy(asc(producibleIngredientIndex.position));

      return rows.map((row) => ({
        productId: row.productId,
        variantId: variantIdOf(row.variantId),
      }));
    });
  }

  override async replaceIndex(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
    ingredientIds: readonly string[],
  ): Promise<void> {
    await this.inTenant(tenantId, async (tx) => {
      const variantId = variantKey(product.variantId);

      await tx
        .delete(producibleIngredientIndex)
        .where(
          and(
            eq(producibleIngredientIndex.tenantId, tenantId),
            eq(producibleIngredientIndex.siteId, siteId),
            eq(producibleIngredientIndex.productId, product.productId),
            eq(producibleIngredientIndex.variantId, variantId),
          ),
        );

      const seen = new Set<string>();

      for (const ingredientId of ingredientIds) {
        if (seen.has(ingredientId)) {
          continue;
        }

        seen.add(ingredientId);
        const position = await nextIndexPosition(
          tx,
          tenantId,
          siteId,
          ingredientId,
        );

        await tx.insert(producibleIngredientIndex).values({
          tenantId,
          siteId,
          ingredientId,
          productId: product.productId,
          variantId,
          position,
        });
      }
    });
  }

  override async find(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
  ): Promise<ProducibleProjection | null> {
    return this.inTenant(tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(producibleQuantities)
        .where(productWhere(tenantId, siteId, product))
        .limit(1);

      if (row === undefined) {
        return null;
      }

      const limits = await tx
        .select({
          ingredientId: producibleLimitingIngredients.ingredientId,
        })
        .from(producibleLimitingIngredients)
        .where(
          and(
            eq(producibleLimitingIngredients.tenantId, tenantId),
            eq(producibleLimitingIngredients.siteId, siteId),
            eq(producibleLimitingIngredients.productId, product.productId),
            eq(
              producibleLimitingIngredients.variantId,
              variantKey(product.variantId),
            ),
          ),
        )
        .orderBy(asc(producibleLimitingIngredients.position));

      return {
        siteId: row.siteId,
        productId: row.productId,
        variantId: variantIdOf(row.variantId),
        pointUnits: asNumber(row.pointUnits),
        replenishmentUnits: asNumber(row.replenishmentUnits),
        limitingIngredientIds: limits.map((limit) => limit.ingredientId),
        state: stateOf(row.state),
      };
    });
  }

  override async save(
    tenantId: string,
    projection: ProducibleProjection,
  ): Promise<void> {
    await this.inTenant(tenantId, async (tx) => {
      const variantId = variantKey(projection.variantId);
      const identity = and(
        eq(producibleQuantities.tenantId, tenantId),
        eq(producibleQuantities.siteId, projection.siteId),
        eq(producibleQuantities.productId, projection.productId),
        eq(producibleQuantities.variantId, variantId),
      );

      await tx.delete(producibleQuantities).where(identity);
      await tx.insert(producibleQuantities).values({
        tenantId,
        siteId: projection.siteId,
        productId: projection.productId,
        variantId,
        pointUnits: projection.pointUnits,
        replenishmentUnits: projection.replenishmentUnits,
        state: projection.state,
      });

      await tx
        .delete(producibleLimitingIngredients)
        .where(
          and(
            eq(producibleLimitingIngredients.tenantId, tenantId),
            eq(producibleLimitingIngredients.siteId, projection.siteId),
            eq(producibleLimitingIngredients.productId, projection.productId),
            eq(producibleLimitingIngredients.variantId, variantId),
          ),
        );

      if (projection.limitingIngredientIds.length === 0) {
        return;
      }

      await tx.insert(producibleLimitingIngredients).values(
        projection.limitingIngredientIds.map((ingredientId, position) => ({
          tenantId,
          siteId: projection.siteId,
          productId: projection.productId,
          variantId,
          position,
          ingredientId,
        })),
      );
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE inventory_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

const nextIndexPosition = async (
  tx: Transaction,
  tenantId: string,
  siteId: string,
  ingredientId: string,
): Promise<number> => {
  const [row] = await tx
    .select({
      value: sql<number>`coalesce(max(${producibleIngredientIndex.position}), -1)`,
    })
    .from(producibleIngredientIndex)
    .where(
      and(
        eq(producibleIngredientIndex.tenantId, tenantId),
        eq(producibleIngredientIndex.siteId, siteId),
        eq(producibleIngredientIndex.ingredientId, ingredientId),
      ),
    );

  return asNumber(row?.value ?? -1) + 1;
};
