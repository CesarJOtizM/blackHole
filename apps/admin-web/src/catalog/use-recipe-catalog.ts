import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { scopeFromDraft, useCatalogScope } from "#src/catalog/catalog-scope.js";
import {
  catalogQueryKey,
  getRecipeCatalog,
} from "#src/catalog/cloud-recipe-api.js";

const SCOPE_REQUIRED = "Empresa, marca y sesión son obligatorias.";

export function useRecipeCatalog() {
  const queryClient = useQueryClient();
  const { draft, applied, rememberScope } = useCatalogScope();
  const [scopeError, setScopeError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: catalogQueryKey(applied),
    queryFn: () => {
      if (applied === null) {
        throw new Error("Catalog scope is missing");
      }

      return getRecipeCatalog(applied);
    },
    enabled: applied !== null,
    retry: false,
  });

  function load() {
    const scope = scopeFromDraft(draft);

    if (scope === null) {
      setScopeError(SCOPE_REQUIRED);
      return;
    }

    setScopeError(null);
    rememberScope(scope);
    void queryClient.invalidateQueries({ queryKey: catalogQueryKey(scope) });
  }

  return { draft, query, load, scopeError };
}
