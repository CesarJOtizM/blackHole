export interface IngredientCategory {
  tenantId: string;
  ingredientId: string;
  category: string;
}

export abstract class IngredientClassification {
  abstract ingredientOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<string | null>;

  abstract save(category: IngredientCategory): Promise<void>;

  abstract find(
    tenantId: string,
    ingredientId: string,
  ): Promise<IngredientCategory | null>;
}
