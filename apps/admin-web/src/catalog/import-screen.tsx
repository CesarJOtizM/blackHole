import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useId, useRef, useState } from "react";
import { AdminPage } from "#src/catalog/admin-page.js";
import { scopeFromDraft, useCatalogScope } from "#src/catalog/catalog-scope.js";
import {
  actionMessage,
  type CatalogScope,
  catalogQueryKey,
  fileContentsBase64,
  importRowsFromPayload,
  importWorkbook,
} from "#src/catalog/cloud-recipe-api.js";
import cloud from "#src/styles/catalog/cloud.module.scss";
import ui from "#src/styles/ui.module.scss";

export function ImportScreen() {
  const fileId = useId();
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { draft, rememberScope } = useCatalogScope();
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const imported = useMutation({
    mutationFn: async (inputFile: { scope: CatalogScope; file: File }) => {
      const contents = await fileContentsBase64(inputFile.file);
      return importWorkbook(inputFile.scope, contents);
    },
    onSuccess: async (result, variables) => {
      if (result.status !== 200) {
        return;
      }

      rememberScope(variables.scope);
      await queryClient.invalidateQueries({
        queryKey: catalogQueryKey(variables.scope),
      });
    },
  });

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setFormError(null);
  }

  function runImport() {
    const scope = scopeFromDraft(draft);

    if (file === null) {
      input.current?.click();
      return;
    }

    if (scope === null) {
      setFormError(
        "El archivo queda elegido. Esta sesión todavía no tiene la marca cargada.",
      );
      return;
    }

    setFormError(null);
    imported.mutate({ scope, file });
  }

  const rows = imported.data ? importRowsFromPayload(imported.data.body) : [];

  return (
    <AdminPage
      title="Importar"
      lede="Un solo archivo"
      action={
        <button
          type="button"
          className={ui.button}
          disabled={imported.isPending}
          onClick={runImport}
        >
          {file ? "Importar" : "Elegir archivo"}
        </button>
      }
    >
      <p className={ui.note}>
        Un Excel con ingredientes y recetas. La empresa y la marca ya son las de
        esta sesión.
      </p>
      <label className={cloud.drop} htmlFor={fileId}>
        <span className={cloud.dropTitle}>
          {file ? file.name : "Suelta el Excel aquí"}
        </span>
        <span className={cloud.dropMeta}>.xlsx · ingredientes y recetas</span>
        <input
          ref={input}
          id={fileId}
          className="srOnly"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={chooseFile}
        />
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
      <p className={ui.note}>
        Si una fila falla, se ve después de elegir el archivo.
      </p>
    </AdminPage>
  );
}
