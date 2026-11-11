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
import { TextField } from "#src/catalog/text-field.js";
import { useRecipeCatalog } from "#src/catalog/use-recipe-catalog.js";
import cloud from "#src/styles/catalog/cloud.module.scss";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

const SAMPLE_RECIPE = [
  ["Churrasco (pieza)", "0,400 KG", "8%", "$38.900", "$16.806"],
  ["Sal parrillera", "0,006 KG", "0%", "$9.000", "$54"],
  ["Chimichurri (sub-receta)", "0,030 KG", "0%", "$18.000", "$540"],
  ["Papa criolla", "0,180 KG", "12%", "$4.300", "$867"],
  ["Limón tahití", "0,020 KG", "0%", "$3.800", "$76"],
] as const;

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
    <AdminPage title="Recetas" lede="Costo teórico de la carta">
      <div className={cloud.split}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <caption className="srOnly">Receta del churrasco</caption>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Cantidad</th>
                <th>Merma</th>
                <th>Costo unit.</th>
                <th>Costo</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_RECIPE.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={`${row[0]}-${index}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className={record.card}>
          <h2 className={record.cardTitle}>Churrasco 400 g</h2>
          <p className={record.fact}>
            <span>Costo receta</span>
            <strong>$18.343</strong>
          </p>
          <p className={record.fact}>
            <span>Precio sin INC</span>
            <strong>$40.741</strong>
          </p>
          <p className={record.fact}>
            <span>Costo / precio</span>
            <strong>45%</strong>
          </p>
          <p className={record.fact}>
            <span>Meta de la marca</span>
            <strong>32%</strong>
          </p>
        </aside>
      </div>
      <form onSubmit={handleLoad} className={cloud.panel}>
        <h2 className={cloud.panelTitle}>Catálogo en la nube</h2>
        <CatalogScopeFields includeVenue />
        {scopeError ? <p className={ui.error}>{scopeError}</p> : null}
        <div className={cloud.actions}>
          <button type="submit" className={ui.button}>
            Cargar catálogo
          </button>
        </div>
      </form>
      {query.isLoading ? <p className={ui.note}>Cargando catálogo…</p> : null}
      {query.isError ? (
        <p className={ui.error} role="alert">
          No se pudo llamar a la nube.{" "}
          <button
            type="button"
            className={ui.textButton}
            onClick={() => void query.refetch()}
          >
            Reintentar
          </button>
        </p>
      ) : null}
      {query.data && query.data.status !== 200 ? (
        <p className={ui.error} role="alert">
          {errorNameFromPayload(query.data.body) ??
            "No se pudo leer el catálogo."}
        </p>
      ) : null}
      {query.data?.status === 200 && catalog === null ? (
        <p className={ui.error} role="alert">
          La respuesta no es un catálogo.
        </p>
      ) : null}
      {catalog !== null && publication === null ? (
        <p className={ui.empty}>Sin versión publicada</p>
      ) : null}
      {publication ? (
        <section className={cloud.panel}>
          <h2 className={cloud.panelTitle}>Versión {publication.version}</h2>
          <RecipeList recipes={publication.recipes} onUse={handleUse} />
        </section>
      ) : null}
      <form onSubmit={handleCost} className={cloud.panel}>
        <h2 className={cloud.panelTitle}>Costo teórico</h2>
        <div className={cloud.grid}>
          <TextField
            label="Producto"
            value={productId}
            autoComplete="off"
            onChange={(event) => setProductId(event.target.value)}
          />
          <TextField
            label="Variante"
            value={variantId}
            autoComplete="off"
            onChange={(event) => setVariantId(event.target.value)}
          />
        </div>
        {costError ? <p className={ui.error}>{costError}</p> : null}
        {cost.isError ? (
          <p className={ui.error} role="alert">
            No se pudo llamar a la nube.
          </p>
        ) : null}
        {cost.data ? <RecipeCostResult payload={cost.data.body} /> : null}
        <div className={cloud.actions}>
          <button type="submit" className={ui.button} disabled={cost.isPending}>
            Ver costo
          </button>
        </div>
      </form>
      <form onSubmit={handlePublish} className={cloud.panel}>
        <h2 className={cloud.panelTitle}>Publicar receta</h2>
        <div className={cloud.grid}>
          <TextField
            label="Id"
            value={recipe.id}
            autoComplete="off"
            onChange={(event) =>
              setRecipe((current) => ({ ...current, id: event.target.value }))
            }
          />
          <TextField
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
          <TextField
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
          <TextField
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
        <div className={cloud.actions}>
          <button
            type="button"
            className={ui.buttonGhost}
            onClick={() => setLines((current) => [...current, createLine()])}
          >
            Agregar línea
          </button>
        </div>
        {formError ? <p className={ui.error}>{formError}</p> : null}
        {publish.isError ? (
          <p className={ui.error} role="alert">
            No se pudo llamar a la nube.
          </p>
        ) : null}
        {publish.data ? (
          <p className={ui.note}>{actionMessage(publish.data)}</p>
        ) : null}
        <div className={cloud.actions}>
          <button
            type="submit"
            className={ui.button}
            disabled={publish.isPending}
          >
            Publicar receta
          </button>
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
    <fieldset className={cloud.line}>
      <legend>Línea</legend>
      <div className={cloud.grid}>
        <ChoiceField
          label="Tipo"
          value={line.kind}
          options={LINE_OPTIONS}
          onChange={(kind) =>
            onChange({
              kind:
                kind === LINE_KIND.RECIPE
                  ? LINE_KIND.RECIPE
                  : LINE_KIND.INGREDIENT,
            })
          }
        />
        <TextField
          label={
            line.kind === LINE_KIND.RECIPE
              ? "Id de receta"
              : "Id de ingrediente"
          }
          value={line.targetId}
          autoComplete="off"
          onChange={(event) => onChange({ targetId: event.target.value })}
        />
        <TextField
          label="Cantidad neta"
          value={line.netQuantity}
          inputMode="numeric"
          autoComplete="off"
          onChange={(event) => onChange({ netQuantity: event.target.value })}
        />
        <TextField
          label="Rendimiento %"
          value={line.yieldPercent}
          inputMode="numeric"
          autoComplete="off"
          onChange={(event) => onChange({ yieldPercent: event.target.value })}
        />
        {line.kind === LINE_KIND.RECIPE ? (
          <label className={cloud.check}>
            <input
              type="checkbox"
              checked={line.stocked}
              onChange={(event) => onChange({ stocked: event.target.checked })}
            />
            Preparado en stock
          </label>
        ) : null}
        <div className={cloud.actions}>
          <button type="button" className={ui.buttonGhost} onClick={onRemove}>
            Quitar línea
          </button>
        </div>
      </div>
    </fieldset>
  );
}

function RecipeCostResult({ payload }: { payload: unknown }) {
  const cost = recipeCostFromPayload(payload);

  if (cost !== null) {
    return (
      <p className={ui.note}>
        Costo teórico {cost.costCop} COP. Margen {cost.marginPercent} %.
      </p>
    );
  }

  const error = errorNameFromPayload(payload);

  if (error !== null) {
    return <p className={ui.error}>{error}</p>;
  }

  return <p className={ui.note}>La respuesta no incluye costo.</p>;
}
