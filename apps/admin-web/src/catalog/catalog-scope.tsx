import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { CatalogScope } from "#src/catalog/cloud-recipe-api.js";
import { TextField } from "#src/catalog/text-field.js";
import cloud from "#src/styles/catalog/cloud.module.scss";

export interface CatalogDraft {
  tenantId: string;
  brandId: string;
  sessionId: string;
  venueId: string;
}

interface CatalogScopeValue {
  draft: CatalogDraft;
  applied: CatalogScope | null;
  updateDraft: (patch: Partial<CatalogDraft>) => void;
  rememberScope: (scope: CatalogScope) => void;
}

const EMPTY_DRAFT: CatalogDraft = {
  tenantId: "",
  brandId: "",
  sessionId: "",
  venueId: "",
};

const CatalogScopeContext = createContext<CatalogScopeValue | null>(null);

export function CatalogScopeProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [applied, setApplied] = useState<CatalogScope | null>(null);
  const updateDraft = useCallback((patch: Partial<CatalogDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);
  const rememberScope = useCallback((scope: CatalogScope) => {
    setApplied(scope);
  }, []);
  const value = useMemo(
    () => ({ draft, applied, updateDraft, rememberScope }),
    [applied, draft, rememberScope, updateDraft],
  );

  return <CatalogScopeContext value={value}>{children}</CatalogScopeContext>;
}

export function useCatalogScope(): CatalogScopeValue {
  const value = use(CatalogScopeContext);

  if (value === null) {
    throw new Error("Catalog scope is missing");
  }

  return value;
}

export function scopeFromDraft(draft: CatalogDraft): CatalogScope | null {
  const tenantId = draft.tenantId.trim();
  const brandId = draft.brandId.trim();
  const sessionId = draft.sessionId.trim();

  if (tenantId.length === 0 || brandId.length === 0 || sessionId.length === 0) {
    return null;
  }

  return { tenantId, brandId, sessionId };
}

export function CatalogScopeFields({
  includeVenue = false,
}: {
  includeVenue?: boolean;
}) {
  const { draft, updateDraft } = useCatalogScope();

  return (
    <div className={cloud.grid}>
      <TextField
        label="Empresa"
        value={draft.tenantId}
        placeholder="pilot"
        autoComplete="off"
        onChange={(event) => updateDraft({ tenantId: event.target.value })}
      />
      <TextField
        label="Marca"
        value={draft.brandId}
        placeholder="parrilla"
        autoComplete="off"
        onChange={(event) => updateDraft({ brandId: event.target.value })}
      />
      <TextField
        label="Sesión"
        value={draft.sessionId}
        placeholder="admin-web"
        autoComplete="off"
        onChange={(event) => updateDraft({ sessionId: event.target.value })}
      />
      {includeVenue ? (
        <TextField
          label="Sede"
          value={draft.venueId}
          placeholder="chapinero"
          autoComplete="off"
          onChange={(event) => updateDraft({ venueId: event.target.value })}
        />
      ) : null}
    </div>
  );
}
