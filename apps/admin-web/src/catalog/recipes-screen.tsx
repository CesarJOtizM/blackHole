import {
  Button,
  EmptyState,
  Field,
  ScreenError,
  Skeleton,
} from "@blackhole/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { AdminPage } from "#src/catalog/admin-page.js";
import { RecipeList } from "#src/catalog/catalog-lists.js";
import {
  CatalogScopeFields,
  scopeFromDraft,
  useCatalogScope,
} from "#src/catalog/catalog-scope.js";
import { ChoiceField } from "#src/catalog/choice-field.js";
import {
  actionMessage,
  type CatalogScope,
  catalogFromPayload,
  catalogQueryKey,
  errorNameFromPayload,
  getRecipeCost,
  LINE_KIND,
  type LineDraft,
  latestPublication,
  publishCatalog,
  type RecipeView,
  recipeCostFromPayload,
  type UpsertRecipeCommand,
  upsertRecipeCommand,
} from "#src/catalog/cloud-recipe-api.js";
import { useRecipeCatalog } from "#src/catalog/use-recipe-catalog.js";

const LINE_OPTIONS = [
  { value: LINE_KIND.INGREDIENT, label: "Ingrediente" },
  { value: LINE_KIND.RECIPE, label: "Subreceta" },
] as const;

let lineKey = 0;

function createLine(): LineDraft {
  lineKey += 1;

  return {
    key: `line-${lineKey}`,
    kind: LINE_KIND.INGREDIENT,
    targetId: "",
    netQuantity: "",
    yieldPercent: "100",
    stocked: false,
  };
}

const EMPTY_RECIPE = {
  id: "",
  name: "",
  productId: "",
  variantId: "",
};

export function RecipesScreen() {
  const queryClient = useQueryClient();
  const { draft, rememberScope } = useCatalogScope();
  const { query, load, scopeError } = useRecipeCatalog();
  const [recipe, setRecipe] = useState(EMPTY_RECIPE);
  const [lines, setLines] = useState<LineDraft[]>(() => [createLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [costError, setCostError] = useState<string | null>(null);
  const publish = useMutation({
    mutationFn: (input: {
      scope: CatalogScope;
      command: UpsertRecipeCommand;
    }) => publishCatalog(input.scope, [input.command]),
    onSuccess: async (result, input) => {
      if (result.status !== 200) {
        return;
      }

      rememberScope(input.scope);
      await queryClient.invalidateQueries({
        queryKey: catalogQueryKey(input.scope),
      });
    },
  });
  const cost = useMutation({
    mutationFn: (input: {
      scope: CatalogScope;
      venueId: string;
      productId: string;
      variantId: string;
    }) =>
      getRecipeCost(
        input.scope,
        input.venueId,
        input.productId,
        input.variantId,
      ),
  });

  function handleLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load();
  }

  function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scope = scopeFromDraft(draft);
    const form = { ...recipe, lines };
    const command = upsertRecipeCommand(form);

    if (scope === null || command === null) {
      setFormError("Revisa empresa, marca, sesión y las líneas enteras.");
      return;
    }

    setFormError(null);
    publish.mutate({ scope, command });
  }

  function handleCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scope = scopeFromDraft(draft);
    const venueId = draft.venueId.trim();
    const product = productId.trim();

    if (scope === null || venueId.length === 0 || product.length === 0) {
      setCostError("Empresa, marca, sesión, sede y producto son obligatorios.");
      return;
    }

    setCostError(null);
    cost.mutate({
      scope,
      venueId,
      productId: product,
      variantId: variantId.trim(),
    });
  }

  function handleUse(recipeView: RecipeView) {
    setProductId(recipeView.productId);
    setVariantId(recipeView.variantId ?? "");
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  const catalog =
    query.data?.status === 200 ? catalogFromPayload(query.data.body) : null;
  const publication = catalog === null ? null : latestPublication(catalog);

  return (
    <AdminPage
      title="Recetas"
      lede="El costo y el margen se muestran solo si la respuesta los trae."
    >
      <form onSubmit={handleLoad} className="grid gap-4">
        <CatalogScopeFields includeVenue />
        {scopeError ? (
          <p className="font-semibold text-danger">{scopeError}</p>
        ) : null}
        <div>
          <Button type="submit">Cargar catálogo</Button>
        </div>
      </form>
      {query.isLoading ? <Skeleton className="h-24" /> : null}
      {query.isError ? (
        <ScreenError
          title="Catálogo"
          message="No se pudo llamar a la nube."
          onRetry={() => void query.refetch()}
        />
      ) : null}
      {query.data && query.data.status !== 200 ? (
        <ScreenError
          title="Catálogo"
          message={
            errorNameFromPayload(query.data.body) ??
            "No se pudo leer el catálogo."
          }
        />
      ) : null}
      {query.data?.status === 200 && catalog === null ? (
        <ScreenError
          title="Catálogo"
          message="La respuesta no es un catálogo."
        />
      ) : null}
      {catalog !== null && publication === null ? (
        <EmptyState title="Sin versión publicada" />
      ) : null}
      {publication ? (
        <section className="grid gap-4">
          <p className="text-ink-muted">Versión {publication.version}</p>
          <RecipeList recipes={publication.recipes} onUse={handleUse} />
        </section>
      ) : null}
      <form onSubmit={handleCost} className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Costo teórico</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Producto"
            value={productId}
            autoComplete="off"
            onChange={(event) => setProductId(event.target.value)}
          />
          <Field
            label="Variante"
            value={variantId}
            autoComplete="off"
            onChange={(event) => setVariantId(event.target.value)}
          />
        </div>
        {costError ? (
          <p className="font-semibold text-danger">{costError}</p>
        ) : null}
        {cost.isError ? (
          <ScreenError title="Costo" message="No se pudo llamar a la nube." />
        ) : null}
        {cost.data ? <RecipeCostResult payload={cost.data.body} /> : null}
        <div>
          <Button type="submit" disabled={cost.isPending}>
            Ver costo
          </Button>
        </div>
      </form>
      <form onSubmit={handlePublish} className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Publicar receta
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Id"
            value={recipe.id}
            autoComplete="off"
            onChange={(event) =>
              setRecipe((current) => ({ ...current, id: event.target.value }))
            }
          />
          <Field
            label="Nombre"
            value={recipe.name}
            autoComplete="off"
            onChange={(event) =>
              setRecipe((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
          <Field
            label="Producto de la receta"
            value={recipe.productId}
            autoComplete="off"
            onChange={(event) =>
              setRecipe((current) => ({
                ...current,
                productId: event.target.value,
              }))
            }
          />
          <Field
            label="Variante de la receta"
            value={recipe.variantId}
            autoComplete="off"
            onChange={(event) =>
              setRecipe((current) => ({
                ...current,
                variantId: event.target.value,
              }))
            }
          />
        </div>
        {lines.map((line) => (
          <RecipeLineFields
            key={line.key}
            line={line}
            onChange={(patch) => updateLine(line.key, patch)}
            onRemove={() =>
              setLines((current) =>
                current.filter((item) => item.key !== line.key),
              )
            }
          />
        ))}
        <div>
          <Button
            variant="secondary"
            onClick={() => setLines((current) => [...current, createLine()])}
          >
            Agregar línea
          </Button>
        </div>
        {formError ? (
          <p className="font-semibold text-danger">{formError}</p>
        ) : null}
        {publish.isError ? (
          <ScreenError
            title="Publicación"
            message="No se pudo llamar a la nube."
          />
        ) : null}
        {publish.data ? (
          <p className="text-ink">{actionMessage(publish.data)}</p>
        ) : null}
        <div>
          <Button type="submit" disabled={publish.isPending}>
            Publicar receta
          </Button>
        </div>
      </form>
    </AdminPage>
  );
}

function RecipeLineFields({
  line,
  onChange,
  onRemove,
}: {
  line: LineDraft;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <fieldset className="grid gap-4 rounded-xl border-2 border-border p-4 sm:grid-cols-2">
      <legend className="px-2 font-semibold text-ink">Línea</legend>
      <ChoiceField
        label="Tipo"
        value={line.kind}
        options={LINE_OPTIONS}
        onChange={(kind) => onChange({ kind })}
      />
      <Field
        label={
          line.kind === LINE_KIND.RECIPE ? "Id de receta" : "Id de ingrediente"
        }
        value={line.targetId}
        autoComplete="off"
        onChange={(event) => onChange({ targetId: event.target.value })}
      />
      <Field
        label="Cantidad neta"
        value={line.netQuantity}
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => onChange({ netQuantity: event.target.value })}
      />
      <Field
        label="Rendimiento %"
        value={line.yieldPercent}
        inputMode="numeric"
        autoComplete="off"
        onChange={(event) => onChange({ yieldPercent: event.target.value })}
      />
      {line.kind === LINE_KIND.RECIPE ? (
        <label className="flex min-h-12 items-center gap-2 text-base font-semibold text-ink">
          <input
            type="checkbox"
            checked={line.stocked}
            onChange={(event) => onChange({ stocked: event.target.checked })}
          />
          Preparado en stock
        </label>
      ) : null}
      <div>
        <Button variant="secondary" onClick={onRemove}>
          Quitar línea
        </Button>
      </div>
    </fieldset>
  );
}

function RecipeCostResult({ payload }: { payload: unknown }) {
  const cost = recipeCostFromPayload(payload);

  if (cost !== null) {
    return (
      <p className="text-ink">
        Costo teórico {cost.costCop} COP. Margen {cost.marginPercent} %.
      </p>
    );
  }

  const error = errorNameFromPayload(payload);

  if (error !== null) {
    return <p className="font-semibold text-danger">{error}</p>;
  }

  return <p className="text-ink-muted">La respuesta no incluye costo.</p>;
}
