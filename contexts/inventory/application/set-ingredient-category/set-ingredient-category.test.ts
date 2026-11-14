import { expect, it, vi } from "vitest";

import {
  type IngredientCategory,
  IngredientClassification,
} from "#application/ports/ingredient-classification.js";
import {
  IngredientHidden,
  SetIngredientCategory,
} from "#application/set-ingredient-category/set-ingredient-category.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const MILK_ID = "ingredient_milk";
const DAIRY = "dairy";

const dairyFor = (tenantId: string): IngredientCategory => ({
  tenantId,
  ingredientId: MILK_ID,
  category: DAIRY,
});

class MemoryIngredientClassification extends IngredientClassification {
  private readonly ingredients = new Set<string>();
  private readonly categories = new Map<string, IngredientCategory>();

  know(tenantId: string, ingredientId: string): void {
    this.ingredients.add(this.key(tenantId, ingredientId));
  }

  async ingredientOf(
    tenantId: string,
    ingredientId: string,
  ): Promise<string | null> {
    if (!this.ingredients.has(this.key(tenantId, ingredientId))) {
      return null;
    }

    return ingredientId;
  }

  async save(category: IngredientCategory): Promise<void> {
    this.categories.set(this.key(category.tenantId, category.ingredientId), {
      ...category,
    });
  }

  async find(
    tenantId: string,
    ingredientId: string,
  ): Promise<IngredientCategory | null> {
    return this.categories.get(this.key(tenantId, ingredientId)) ?? null;
  }

  private key(tenantId: string, ingredientId: string): string {
    return `${tenantId}\u0000${ingredientId}`;
  }
}

it("given milk in this company, when it is classified as dairy, then the classification is stored for that ingredient", async () => {
  const classifications = new MemoryIngredientClassification();
  classifications.know(TENANT_A, MILK_ID);
  const setCategory = new SetIngredientCategory(classifications);

  const stored = await setCategory.execute({
    tenantId: TENANT_A,
    ingredientId: MILK_ID,
    category: DAIRY,
  });

  expect(stored).toEqual(dairyFor(TENANT_A));
  expect(Object.keys(stored).toSorted()).toEqual([
    "category",
    "ingredientId",
    "tenantId",
  ]);
  expect(await classifications.find(TENANT_A, MILK_ID)).toEqual(
    dairyFor(TENANT_A),
  );
});

it("given milk classified as dairy for one company, when another company reads that ingredient, then it stays hidden", async () => {
  const classifications = new MemoryIngredientClassification();
  classifications.know(TENANT_A, MILK_ID);
  const setCategory = new SetIngredientCategory(classifications);
  const save = vi.spyOn(classifications, "save");
  await setCategory.execute({
    tenantId: TENANT_A,
    ingredientId: MILK_ID,
    category: DAIRY,
  });

  const hidden = setCategory.execute({
    tenantId: TENANT_B,
    ingredientId: MILK_ID,
    category: "meat",
  });

  await expect(hidden).rejects.toThrow(IngredientHidden);
  expect(save).toHaveBeenCalledTimes(1);
  expect(await classifications.find(TENANT_B, MILK_ID)).toBeNull();
  expect(await classifications.ingredientOf(TENANT_B, MILK_ID)).toBeNull();
  expect(await classifications.find(TENANT_A, MILK_ID)).toEqual(
    dairyFor(TENANT_A),
  );
});
