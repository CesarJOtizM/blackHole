import type {
  IngredientView,
  RecipeLineView,
  RecipeView,
} from "#src/catalog/cloud-recipe-api.js";
import { LINE_KIND } from "#src/catalog/cloud-recipe-api.js";
import cloud from "#src/styles/catalog/cloud.module.scss";
import ui from "#src/styles/ui.module.scss";

export function IngredientList({
  ingredients,
}: {
  ingredients: readonly IngredientView[];
}) {
  if (ingredients.length === 0) {
    return <p className={ui.empty}>Sin ingredientes</p>;
  }

  return (
    <ul className={cloud.list}>
      {ingredients.map((ingredient) => (
        <li key={ingredient.id} className={cloud.panel}>
          <p className={cloud.itemTitle}>{ingredient.name}</p>
          <p className={cloud.meta}>
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
    return <p className={ui.empty}>Sin recetas</p>;
  }

  return (
    <ul className={cloud.list}>
      {recipes.map((recipe) => (
        <li key={recipe.id} className={cloud.panel}>
          <p className={cloud.itemTitle}>{recipe.name}</p>
          <p className={cloud.meta}>
            {recipe.id}. Producto {recipe.productId}
            {recipe.variantId ? `. Variante ${recipe.variantId}` : ""}.
          </p>
          <ul className={cloud.list}>
            {recipe.lines.map((line, index) => (
              <li key={`${recipe.id}:${index}`} className={cloud.meta}>
                {lineText(line)}
              </li>
            ))}
          </ul>
          {onUse ? (
            <div className={cloud.actions}>
              <button
                type="button"
                className={ui.buttonGhost}
                onClick={() => onUse(recipe)}
              >
                Usar para costo
              </button>
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
