import { attention, homeMetrics, liveVenues } from "#src/home/home-source.js";
import { type Cell, RecordPage } from "#src/shell/record-page.js";
import record from "#src/styles/record.module.scss";

const tone = {
  Atraso: "stamp",
  Normal: "go",
  "Rappi pausado": "hold",
} as const;

export function HomeView({
  onOpen,
  onExport,
  status,
}: {
  onOpen: (path: (typeof attention)[number]["to"]) => void;
  onExport: () => void;
  status?: string;
}) {
  const rows: Cell[][] = liveVenues.map((venue) => [
    venue[0],
    venue[1],
    venue[2],
    venue[3],
    venue[4],
    { chip: venue[5], tone: tone[venue[5]] },
  ]);

  return (
    <RecordPage
      eyebrow="Hoy · actualizado 14:20"
      title="Buen día, Carolina"
      actions={[{ label: "Exportar", tone: "ghost", onPress: onExport }]}
      metrics={[...homeMetrics]}
      columns={["Sede", "Modo", "Ventas", "Mesas", "P90", "Estado"]}
      rows={rows}
      caption="Sedes en vivo"
      status={status}
    >
      <section className={record.attention} aria-label="Requiere tu atención">
        <h2 className={record.cardTitle}>Requiere tu atención</h2>
        {attention.map((item) => (
          <button
            key={item.id}
            type="button"
            className={record.attentionItem}
            onClick={() => onOpen(item.to)}
          >
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </button>
        ))}
      </section>
    </RecordPage>
  );
}
