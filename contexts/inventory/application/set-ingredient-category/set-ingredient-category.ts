import type {
  IngredientCategory,
  IngredientClassification,
} from "#application/ports/ingredient-classification.js";

export class IngredientHidden extends Error {
  constructor() {
    super("The ingredient is not visible in this company.");
    this.name = "IngredientHidden";
  }
}

export interface SetIngredientCategoryInput {
  tenantId: string;
  ingredientId: string;
  category: string;
}

export class SetIngredientCategory {
  constructor(private readonly classifications: IngredientClassification) {}

  async execute(
    input: SetIngredientCategoryInput,
  ): Promise<IngredientCategory> {
    const ingredientId = await this.classifications.ingredientOf(
      input.tenantId,
      input.ingredientId,
    );

    if (ingredientId === null) {
      throw new IngredientHidden();
    }

    const stored: IngredientCategory = {
      tenantId: input.tenantId,
      ingredientId,
      category: input.category,
    };
    await this.classifications.save(stored);

    return stored;
  }
}
