export interface StockLevel {
  locationId: string;
  ingredientId: string;
  minimum: number;
  maximum: number;
}

export abstract class StockLevelRepository {
  abstract find(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<StockLevel | null>;

  abstract save(tenantId: string, level: StockLevel): Promise<void>;
}
