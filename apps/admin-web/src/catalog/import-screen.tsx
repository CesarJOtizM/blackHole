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
import cloud from "#src/styles/catalog/cloud.module.scss";
import ui from "#src/styles/ui.module.scss";

const SAMPLE_ROWS = [
  ["Churrasco (pieza)", "kg", "1000", "38900"],
  ["Papa criolla", "kg", "1000", "4300"],
  ["Caja domicilio", "und", "1", "1150"],
] as const;

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
    <AdminPage title="Importar" lede="Excel de ingredientes y recetas">
      <form onSubmit={handleImport} className={cloud.panel}>
        <h2 className={cloud.panelTitle}>Archivo</h2>
        <CatalogScopeFields />
        <label className={cloud.file} htmlFor={fileId}>
          <span className={ui.fieldLabel}>Archivo Excel</span>
          <input
            id={fileId}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFile}
          />
          <span className={cloud.meta}>
            {file ? file.name : "Elige un .xlsx. Se envía a la nube en base64."}
          </span>
        </label>
        {formError ? <p className={ui.error}>{formError}</p> : null}
        {imported.isError ? (
          <p className={ui.error} role="alert">
            No se pudo llamar a la nube.
          </p>
        ) : null}
        {imported.data ? (
          <p className={ui.note}>{actionMessage(imported.data)}</p>
        ) : null}
        {rows.length > 0 ? (
          <ul className={cloud.list}>
            {rows.map((row) => (
              <li key={`${row.row}:${row.reason}`} className={ui.error}>
                Fila {row.row}: {row.reason}
              </li>
            ))}
          </ul>
        ) : null}
        {published ? (
          <section>
            <h2 className={cloud.panelTitle}>Versión {published.version}</h2>
            <RecipeList recipes={published.recipes} />
          </section>
        ) : null}
        <div className={cloud.actions}>
          <button
            type="submit"
            className={ui.button}
            disabled={imported.isPending}
          >
            Importar
          </button>
        </div>
      </form>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <caption className="srOnly">Columnas esperadas del Excel</caption>
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Unidad</th>
              <th>Factor</th>
              <th>Costo COP</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_ROWS.map((row) => (
              <tr key={row[0]}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
