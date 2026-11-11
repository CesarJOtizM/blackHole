import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { AdminPage } from "#src/catalog/admin-page.js";
import { IngredientList } from "#src/catalog/catalog-lists.js";
import {
  CatalogScopeFields,
  scopeFromDraft,
  useCatalogScope,
} from "#src/catalog/catalog-scope.js";
import { ChoiceField } from "#src/catalog/choice-field.js";
import {
  actionMessage,
  BASE_UNIT,
  type CatalogScope,
  catalogFromPayload,
  catalogQueryKey,
  errorNameFromPayload,
  type IngredientForm,
  latestPublication,
  publishCatalog,
  type UpsertIngredientCommand,
  upsertIngredientCommand,
} from "#src/catalog/cloud-recipe-api.js";
import { TextField } from "#src/catalog/text-field.js";
import { useRecipeCatalog } from "#src/catalog/use-recipe-catalog.js";
import cloud from "#src/styles/catalog/cloud.module.scss";
import ui from "#src/styles/ui.module.scss";

const EMPTY_INGREDIENT: IngredientForm = {
  id: "",
  name: "",
  baseUnit: BASE_UNIT.GRAM,
  purchaseUnitName: "",
  purchaseBaseQuantity: "",
  recipeUnitName: "",
  recipeBaseQuantity: "",
  referenceCostCop: "",
};

const SAMPLE_INGREDIENTS = [
  ["Churrasco (pieza)", "g", "kg", "1000", "g", "1", "$38.900"],
  ["Entraña", "g", "kg", "1000", "g", "1", "$41.200"],
  ["Papa criolla", "g", "kg", "1000", "g", "1", "$4.300"],
  ["Queso doble crema", "g", "kg", "1000", "g", "1", "$22.500"],
  ["Limón tahití", "g", "kg", "1000", "g", "1", "$3.800"],
  ["Caja domicilio", "unit", "und", "1", "und", "1", "$1.150"],
] as const;

const BASE_UNIT_OPTIONS = [
  { value: BASE_UNIT.GRAM, label: "g" },
  { value: BASE_UNIT.MILLILITRE, label: "ml" },
  { value: BASE_UNIT.UNIT, label: "unit" },
] as const;

export function IngredientsScreen() {
  const queryClient = useQueryClient();
  const { draft, rememberScope } = useCatalogScope();
  const { query, load, scopeError } = useRecipeCatalog();
  const [form, setForm] = useState(EMPTY_INGREDIENT);
  const [formError, setFormError] = useState<string | null>(null);
  const publish = useMutation({
    mutationFn: (input: {
      scope: CatalogScope;
      commands: readonly UpsertIngredientCommand[];
    }) => publishCatalog(input.scope, input.commands),
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

  function handleLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load();
  }

  function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scope = scopeFromDraft(draft);
    const command = upsertIngredientCommand(form);

    if (scope === null || command === null) {
      setFormError("Revisa empresa, marca, sesión y las cantidades enteras.");
      return;
    }

    setFormError(null);
    publish.mutate({ scope, commands: [command] });
  }

  const catalog =
    query.data?.status === 200 ? catalogFromPayload(query.data.body) : null;
  const publication = catalog === null ? null : latestPublication(catalog);

  return (
    <AdminPage
      title="Ingredientes"
      lede="Unidades, factores y costo de referencia"
    >
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <caption className="srOnly">Ingredientes de la muestra</caption>
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Base</th>
              <th>Compra</th>
              <th>Factor</th>
              <th>Receta</th>
              <th>Factor</th>
              <th>Costo</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_INGREDIENTS.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td key={`${row[0]}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={handleLoad} className={cloud.panel}>
        <h2 className={cloud.panelTitle}>Catálogo en la nube</h2>
        <CatalogScopeFields />
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
          <IngredientList ingredients={publication.ingredients} />
        </section>
      ) : null}
      <form onSubmit={handlePublish} className={cloud.panel}>
        <h2 className={cloud.panelTitle}>Publicar ingrediente</h2>
        <div className={cloud.grid}>
          <TextField
            label="Id"
            value={form.id}
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({ ...current, id: event.target.value }))
            }
          />
          <TextField
            label="Nombre"
            value={form.name}
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
          <ChoiceField
            label="Unidad base"
            value={form.baseUnit}
            options={BASE_UNIT_OPTIONS}
            onChange={(baseUnit) =>
              setForm((current) => ({ ...current, baseUnit }))
            }
          />
          <TextField
            label="Unidad de compra"
            value={form.purchaseUnitName}
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                purchaseUnitName: event.target.value,
              }))
            }
          />
          <TextField
            label="Factor de compra"
            value={form.purchaseBaseQuantity}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                purchaseBaseQuantity: event.target.value,
              }))
            }
          />
          <TextField
            label="Unidad de receta"
            value={form.recipeUnitName}
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recipeUnitName: event.target.value,
              }))
            }
          />
          <TextField
            label="Factor de receta"
            value={form.recipeBaseQuantity}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                recipeBaseQuantity: event.target.value,
              }))
            }
          />
          <TextField
            label="Costo de referencia (COP)"
            value={form.referenceCostCop}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                referenceCostCop: event.target.value,
              }))
            }
          />
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
            Publicar ingrediente
          </button>
        </div>
      </form>
    </AdminPage>
  );
}
