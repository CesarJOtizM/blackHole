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
import { useRecipeCatalog } from "#src/catalog/use-recipe-catalog.js";

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
      lede="Unidades, factores y costo de referencia en la nube."
    >
      <form onSubmit={handleLoad} className="grid gap-4">
        <CatalogScopeFields />
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
          <IngredientList ingredients={publication.ingredients} />
        </section>
      ) : null}
      <form onSubmit={handlePublish} className="grid gap-4">
        <h2 className="text-xl font-semibold tracking-tight">
          Publicar ingrediente
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Id"
            value={form.id}
            autoComplete="off"
            onChange={(event) =>
              setForm((current) => ({ ...current, id: event.target.value }))
            }
          />
          <Field
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
          <Field
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
          <Field
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
          <Field
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
          <Field
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
          <Field
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
            Publicar ingrediente
          </Button>
        </div>
      </form>
    </AdminPage>
  );
}
