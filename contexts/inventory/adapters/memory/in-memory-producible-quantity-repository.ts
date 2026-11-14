import {
  type ProducibleProduct,
  type ProducibleProjection,
  ProducibleQuantityRepository,
} from "#application/ports/producible-quantity-repository.js";

interface StockMovementRow {
  tenantId: string;
}

const indexKey = (
  tenantId: string,
  siteId: string,
  ingredientId: string,
): string => `${tenantId}\u0000${siteId}\u0000${ingredientId}`;

const rowKey = (
  tenantId: string,
  siteId: string,
  product: ProducibleProduct,
): string =>
  `${tenantId}\u0000${siteId}\u0000${product.productId}\u0000${product.variantId ?? ""}`;

const sameProduct = (
  left: ProducibleProduct,
  right: ProducibleProduct,
): boolean =>
  left.productId === right.productId && left.variantId === right.variantId;

const copyProduct = (product: ProducibleProduct): ProducibleProduct => ({
  productId: product.productId,
  variantId: product.variantId,
});

const copyProjection = (
  projection: ProducibleProjection,
): ProducibleProjection => ({
  siteId: projection.siteId,
  productId: projection.productId,
  variantId: projection.variantId,
  pointUnits: projection.pointUnits,
  replenishmentUnits: projection.replenishmentUnits,
  limitingIngredientIds: [...projection.limitingIngredientIds],
  state: projection.state,
});

export class InMemoryProducibleQuantityRepository extends ProducibleQuantityRepository {
  private readonly explodeIndex = new Map<string, ProducibleProduct[]>();

  private readonly rows = new Map<string, ProducibleProjection>();

  private readonly stockMovementRows: StockMovementRow[] = [];

  stockMovements(tenantId: string): readonly StockMovementRow[] {
    return this.stockMovementRows
      .filter((row) => row.tenantId === tenantId)
      .map((row) => ({ tenantId: row.tenantId }));
  }

  override async productsFor(
    tenantId: string,
    siteId: string,
    ingredientId: string,
  ): Promise<readonly ProducibleProduct[]> {
    const products =
      this.explodeIndex.get(indexKey(tenantId, siteId, ingredientId)) ?? [];

    return products.map(copyProduct);
  }

  override async replaceIndex(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
    ingredientIds: readonly string[],
  ): Promise<void> {
    const prefix = `${tenantId}\u0000${siteId}\u0000`;
    const stored = copyProduct(product);

    for (const [key, products] of this.explodeIndex) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const remaining = products.filter(
        (indexed) => !sameProduct(indexed, product),
      );

      if (remaining.length === 0) {
        this.explodeIndex.delete(key);
      } else if (remaining.length !== products.length) {
        this.explodeIndex.set(key, remaining);
      }
    }

    const seen = new Set<string>();

    for (const ingredientId of ingredientIds) {
      if (seen.has(ingredientId)) {
        continue;
      }

      seen.add(ingredientId);
      const key = indexKey(tenantId, siteId, ingredientId);
      const current = this.explodeIndex.get(key) ?? [];
      this.explodeIndex.set(key, [...current, stored]);
    }
  }

  override async find(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
  ): Promise<ProducibleProjection | null> {
    const row = this.rows.get(rowKey(tenantId, siteId, product));

    return row === undefined ? null : copyProjection(row);
  }

  override async save(
    tenantId: string,
    projection: ProducibleProjection,
  ): Promise<void> {
    this.rows.set(
      rowKey(tenantId, projection.siteId, projection),
      copyProjection(projection),
    );
  }
}
