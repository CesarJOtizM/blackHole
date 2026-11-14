export interface RecipeVersionQuery {
  tenantId: string;
  brandId: string;
  productId: string;
  variantIds: readonly string[];
}

export abstract class RecipeVersionReader {
  abstract current(input: RecipeVersionQuery): Promise<number | null>;
}
