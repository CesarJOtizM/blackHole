import { useEffect, useState } from "react";
import { formatCop, parseCop } from "#src/catalog/source/money.js";
import type { QrMode, QrSettings } from "#src/catalog/source/types.js";
import styles from "#src/styles/catalog/qr-orders.module.scss";
import ui from "#src/styles/ui.module.scss";

const modes: Array<{ id: QrMode; title: string; detail: string }> = [
  { id: "view-only", title: "Solo ver carta", detail: "Sin pedidos" },
  {
    id: "accept",
    title: "Pedir con aceptación",
    detail: "El mesero acepta cada pedido",
  },
  { id: "direct", title: "Pedir directo", detail: "Va a cocina sin revisión" },
];

const preview = [
  { name: "Churrasco 400 g", price: 44000 },
  { name: "Bife de chorizo", price: 52000 },
  { name: "Limonada de coco", price: 12000 },
];

export interface QrOrdersViewProps {
  settings: QrSettings | undefined;
  isSaving: boolean;
  isSaved: boolean;
  onSave: (settings: QrSettings) => void;
}

export function QrOrdersView({
  settings,
  isSaving,
  isSaved,
  onSave,
}: QrOrdersViewProps) {
  if (settings === undefined) {
    return (
      <div className={styles.content}>
        <p className={ui.note}>Cargando los pedidos por QR</p>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <QrEditor
        settings={settings}
        isSaving={isSaving}
        isSaved={isSaved}
        onSave={onSave}
      />
    </div>
  );
}

function QrEditor({
  settings,
  isSaving,
  isSaved,
  onSave,
}: {
  settings: QrSettings;
  isSaving: boolean;
  isSaved: boolean;
  onSave: (settings: QrSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    setDraft(settings);
  }, [settings]);
  const previewLabel =
    draft.mode === "view-only" ? "Ver carta" : "Ver pedido · 2";

  return (
    <>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>
            Lo que puede hacer el cliente desde su celular
          </p>
          <h1 className={ui.title}>Pedidos por QR</h1>
        </div>
        <button
          type="button"
          className={ui.button}
          disabled={isSaving}
          onClick={() => onSave(draft)}
        >
          Guardar
        </button>
      </header>
      <h2 className={styles.sectionTitle}>Modo del QR</h2>
      <div className={styles.modes}>
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={draft.mode === mode.id ? styles.modeActive : styles.mode}
            aria-pressed={draft.mode === mode.id}
            onClick={() => setDraft({ ...draft, mode: mode.id })}
          >
            <span className={styles.modeTitle}>{mode.title}</span>
            <span className={styles.modeDetail}>{mode.detail}</span>
          </button>
        ))}
      </div>
      <div className={styles.layout}>
        <div>
          <h2 className={styles.sectionTitle}>El cliente puede</h2>
          {draft.capabilities.map((capability) => (
            <div key={capability.id} className={styles.row}>
              <div>
                <strong>{capability.title}</strong>
                <span>{capability.detail}</span>
              </div>
              <button
                type="button"
                className={capability.enabled ? ui.switchOn : ui.switch}
                role="switch"
                aria-checked={capability.enabled}
                aria-label={capability.title}
                onClick={() => {
                  setDraft({
                    ...draft,
                    capabilities: draft.capabilities.map((item) =>
                      item.id === capability.id
                        ? { ...item, enabled: !item.enabled }
                        : item,
                    ),
                  });
                }}
              >
                <span className={ui.knob} />
              </button>
            </div>
          ))}
          <h2 className={styles.sectionTitle}>Límites</h2>
          <div className={styles.row}>
            <strong>Mesa sin mesero asignado</strong>
            <span className={styles.limitValue}>{draft.unassignedTable}</span>
          </div>
          <label className={styles.row}>
            <strong>Pedido máximo sin aceptar</strong>
            <input
              className={`${ui.input} ${styles.limitValue}`}
              value={formatCop(draft.maxUnacceptedAmount)}
              onChange={(event) => {
                const amount = parseCop(event.target.value);
                if (amount !== null) {
                  setDraft({ ...draft, maxUnacceptedAmount: amount });
                }
              }}
            />
          </label>
          <label className={styles.row}>
            <strong>Horario</strong>
            <input
              className={`${ui.input} ${styles.limitValue}`}
              value={draft.hours}
              onChange={(event) =>
                setDraft({ ...draft, hours: event.target.value })
              }
            />
          </label>
          {isSaved ? (
            <p className={ui.note} role="status">
              Guardado en esta sesión.
            </p>
          ) : null}
        </div>
        <aside className={styles.phone}>
          <p className={styles.phoneKicker}>Así lo ve el cliente</p>
          <p className={styles.phoneKicker}>La Parrilla · Mesa 08</p>
          <h2 className={styles.phoneTitle}>¿Qué vas a pedir?</h2>
          {preview.map((item) => (
            <div key={item.name} className={styles.phoneItem}>
              <span>{item.name}</span>
              <strong>{formatCop(item.price)}</strong>
            </div>
          ))}
          <button
            type="button"
            className={`${ui.button} ${styles.phoneButton}`}
          >
            {previewLabel}
          </button>
        </aside>
      </div>
    </>
  );
}
