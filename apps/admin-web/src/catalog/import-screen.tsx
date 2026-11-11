import { Button, ScreenError } from "@blackhole/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, type FormEvent, useId, useState } from "react";
import { AdminPage } from "#src/catalog/admin-page.js";
import { RecipeList } from "#src/catalog/catalog-lists.js";
import {
  CatalogScopeFields,
  scopeFromDraft,
  useCatalogScope,
} from "#src/catalog/catalog-scope.js";
import {
  actionMessage,
  type CatalogScope,
  catalogQueryKey,
  fileContentsBase64,
  importRowsFromPayload,
  importWorkbook,
  publicationFromPayload,
} from "#src/catalog/cloud-recipe-api.js";

export function ImportScreen() {
  const fileId = useId();
  const queryClient = useQueryClient();
  const { draft, rememberScope } = useCatalogScope();
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const imported = useMutation({
    mutationFn: async (input: { scope: CatalogScope; file: File }) => {
      const contents = await fileContentsBase64(input.file);
      return importWorkbook(input.scope, contents);
    },
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

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scope = scopeFromDraft(draft);

    if (scope === null || file === null) {
      setFormError("Empresa, marca, sesión y el archivo son obligatorios.");
      return;
    }

    setFormError(null);
    imported.mutate({ scope, file });
  }

  const rows = imported.data ? importRowsFromPayload(imported.data.body) : [];
  const published = imported.data
    ? publicationFromPayload(imported.data.body)
    : null;

  return (
    <AdminPage
      title="Importar"
      lede="El Excel se envía a la nube como base64. El costo no se inventa aquí."
    >
      <form onSubmit={handleImport} className="grid gap-4">
        <CatalogScopeFields />
        <div className="grid gap-2">
          <label htmlFor={fileId} className="text-base font-semibold text-ink">
            Archivo Excel
          </label>
          <input
            id={fileId}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
            className="min-h-12 text-body text-ink"
          />
        </div>
        {formError ? (
          <p className="font-semibold text-danger">{formError}</p>
        ) : null}
        {imported.isError ? (
          <ScreenError
            title="Importación"
            message="No se pudo llamar a la nube."
          />
        ) : null}
        {imported.data ? (
          <p className="text-ink">{actionMessage(imported.data)}</p>
        ) : null}
        {rows.length > 0 ? (
          <ul className="grid gap-2">
            {rows.map((row) => (
              <li key={`${row.row}:${row.reason}`} className="text-danger">
                Fila {row.row}: {row.reason}
              </li>
            ))}
          </ul>
        ) : null}
        {published ? (
          <section className="grid gap-4">
            <p className="text-ink-muted">Versión {published.version}</p>
            <RecipeList recipes={published.recipes} />
          </section>
        ) : null}
        <div>
          <Button type="submit" disabled={imported.isPending}>
            Importar
          </Button>
        </div>
      </form>
    </AdminPage>
  );
}
