import type { ScarcityAlert, ScarcityState } from "#src/api/admin-api.js";
import { type Cell, RecordPage } from "#src/shell/record-page.js";
import ui from "#src/styles/ui.module.scss";

const stateLabel: Record<ScarcityState, string> = {
  open: "Abierta",
  seen: "Vista",
  resolved: "Resuelta",
};

const stateTone: Record<ScarcityState, "hold" | "ink" | "go"> = {
  open: "hold",
  seen: "ink",
  resolved: "go",
};

export function ScarcityInboxView({
  filter,
  alerts,
  status,
  onFilter,
  onOpen,
}: {
  filter: ScarcityState;
  alerts: ScarcityAlert[];
  status?: string;
  onFilter: (filter: ScarcityState) => void;
  onOpen: (alert: ScarcityAlert) => void;
}) {
  const rows: Cell[][] = alerts.map((alert) => [
    alert.name,
    alert.pointBalance,
    alert.minimum,
    alert.route === "warehouse" ? "Bodega" : "Compra",
    { chip: stateLabel[alert.state], tone: stateTone[alert.state] },
  ]);

  return (
    <RecordPage
      eyebrow="Antes de quedarse sin plato"
      title="Alertas de escasez"
      tabs={[
        {
          id: "open",
          label: "Abiertas",
          active: filter === "open",
          onSelect: () => onFilter("open"),
        },
        {
          id: "seen",
          label: "Vistas",
          active: filter === "seen",
          onSelect: () => onFilter("seen"),
        },
        {
          id: "resolved",
          label: "Resueltas",
          active: filter === "resolved",
          onSelect: () => onFilter("resolved"),
        },
      ]}
      columns={[
        "Insumo",
        "Saldo en el punto",
        "Mínimo",
        "Siguiente paso",
        "Estado",
      ]}
      rows={rows}
      caption="Alertas de escasez"
      empty="No hay alertas en este filtro."
      status={status}
    >
      {alerts.map((alert) => (
        <button
          key={alert.id}
          type="button"
          className={ui.textButton}
          onClick={() => onOpen(alert)}
        >
          {alert.route === "warehouse"
            ? `Pedir ${alert.name} a la bodega`
            : `Comprar ${alert.name}`}
        </button>
      ))}
    </RecordPage>
  );
}
