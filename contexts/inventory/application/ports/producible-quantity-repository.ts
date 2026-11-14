import type { AvailabilityState } from "#domain/producible-quantity.js";

export interface ProducibleProduct {
  productId: string;
  variantId: string | null;
}

export interface ProducibleProjection {
  siteId: string;
  productId: string;
  variantId: string | null;
  pointUnits: number;
  replenishmentUnits: number;
  limitingIngredientIds: readonly string[];
  state: AvailabilityState;
}

export abstract class ProducibleQuantityRepository {
  abstract productsFor(
    tenantId: string,
    siteId: string,
    ingredientId: string,
  ): Promise<readonly ProducibleProduct[]>;

  abstract replaceIndex(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
    ingredientIds: readonly string[],
  ): Promise<void>;

  abstract find(
    tenantId: string,
    siteId: string,
    product: ProducibleProduct,
  ): Promise<ProducibleProjection | null>;

  abstract save(
    tenantId: string,
    projection: ProducibleProjection,
  ): Promise<void>;
}
