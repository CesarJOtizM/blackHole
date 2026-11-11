import { useState } from "react";
import type { Contributor, FactusDocument } from "#src/api/admin-api.js";
import { type Cell, RecordPage } from "#src/shell/record-page.js";
import ui from "#src/styles/ui.module.scss";

function documentTone(state: string): "go" | "hold" | "stamp" | "ink" {
  if (state === "Recibido" || state === "Listo para emitir") {
    return "go";
  }

  if (state === "Pedido" || state === "En revisión") {
    return "hold";
  }

  if (state === "Falta") {
    return "stamp";
  }

  return "ink";
}

export function FactusDocumentsView({
  documents,
  status,
  onAsk,
  onContinue,
  onContributors,
}: {
  documents: FactusDocument[];
  status?: string;
  onAsk: () => void;
  onContinue: () => void;
  onContributors: () => void;
}) {
  const rows: Cell[][] = documents.map((document) => [
    document.name,
    { chip: document.state, tone: documentTone(document.state) },
  ]);

  return (
    <RecordPage
      eyebrow="Documentos del NIT"
      title="Requisitos de Factus"
      actions={[
        { label: "Seguir sin emitir", tone: "ghost", onPress: onContinue },
        { label: "Pedir documentos", tone: "solid", onPress: onAsk },
      ]}
      columns={["Documento", "Estado"]}
      rows={rows}
      caption="Documentos del NIT"
      status={status}
    >
      <button type="button" className={ui.textButton} onClick={onContributors}>
        Dos NIT
      </button>
    </RecordPage>
  );
}

export function ContributorsView({
  contributors,
  status,
  error,
  onAdd,
}: {
  contributors: Contributor[];
  status?: string;
  error?: string;
  onAdd: (name: string, nit: string) => boolean;
}) {
  const [name, setName] = useState("");
  const [nit, setNit] = useState("");
  const rows: Cell[][] = contributors.map((contributor) => [
    contributor.name,
    contributor.nit,
    { chip: contributor.state, tone: documentTone(contributor.state) },
  ]);

  return (
    <RecordPage
      eyebrow="Cada NIT factura por su cuenta"
      title="Dos NIT"
      columns={["Contribuyente", "NIT", "Estado"]}
      rows={rows}
      caption="Contribuyentes"
      status={status}
    >
      <form
        className={ui.actions}
        onSubmit={(event) => {
          event.preventDefault();
          if (onAdd(name, nit)) {
            setName("");
            setNit("");
          }
        }}
      >
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Segundo contribuyente</span>
          <input
            className={ui.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>NIT</span>
          <input
            className={ui.input}
            value={nit}
            onChange={(event) => setNit(event.target.value)}
          />
        </label>
        <button type="submit" className={ui.button}>
          Agregar
        </button>
      </form>
      {error ? <p className={ui.error}>{error}</p> : null}
    </RecordPage>
  );
}
