import { Button, EmptyState } from "@blackhole/ui";
import type {
  IngredientView,
  RecipeLineView,
  RecipeView,
} from "#src/catalog/cloud-recipe-api.js";
import { LINE_KIND } from "#src/catalog/cloud-recipe-api.js";

export function IngredientList({
  ingredients,
}: {
  ingredients: readonly IngredientView[];
}) {
  if (ingredients.length === 0) {
    return <EmptyState title="Sin ingredientes" />;
  }

  return (
    <ul className="grid gap-3">
      {ingredients.map((ingredient) => (
        <li
          key={ingredient.id}
          className="rounded-xl border-2 border-border bg-surface-raised p-4"
        >
          <p className="font-semibold text-ink">{ingredient.name}</p>
          <p className="text-ink-muted">
            {ingredient.id}. Base {ingredient.baseUnit}. Compra{" "}
            {ingredient.purchaseUnit.name} ({ingredient.purchaseUnit.factor}).
            Receta {ingredient.recipeUnit.name} ({ingredient.recipeUnit.factor}
            ). Referencia {ingredient.referenceCostCop} COP.
          </p>
        </li>
      ))}
    </ul>
  );
}

export function RecipeList({
  recipes,
  onUse,
}: {
  recipes: readonly RecipeView[];
  onUse?: (recipe: RecipeView) => void;
}) {
  if (recipes.length === 0) {
    return <EmptyState title="Sin recetas" />;
  }

  return (
    <ul className="grid gap-3">
      {recipes.map((recipe) => (
        <li
          key={recipe.id}
          className="grid gap-3 rounded-xl border-2 border-border bg-surface-raised p-4"
        >
          <div>
            <p className="font-semibold text-ink">{recipe.name}</p>
            <p className="text-ink-muted">
              {recipe.id}. Producto {recipe.productId}
              {recipe.variantId ? `. Variante ${recipe.variantId}` : ""}.
            </p>
          </div>
          <ul className="grid gap-1 text-ink-muted">
            {recipe.lines.map((line, index) => (
              <li key={`${recipe.id}:${index}`}>{lineText(line)}</li>
            ))}
          </ul>
          {onUse ? (
            <div>
              <Button variant="secondary" onClick={() => onUse(recipe)}>
                Usar para costo
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function lineText(line: RecipeLineView): string {
  if (line.kind === LINE_KIND.INGREDIENT) {
    return `${line.ingredientId}: ${line.netQuantity}, rendimiento ${line.yieldPercent} %`;
  }

  const stock = line.stocked ? ", en stock" : "";

  return `${line.recipeId}: ${line.netQuantity}, rendimiento ${line.yieldPercent} %${stock}`;
}
