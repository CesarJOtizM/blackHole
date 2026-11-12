import { BarChart } from "#src/reports/bar-chart.js";
import {
  type ReportSection,
  reportSections,
  reports,
} from "#src/reports/reports-model.js";
import { RecordPage } from "#src/shell/record-page.js";

const labels: Record<ReportSection, string> = {
  sales: "Ventas",
  times: "Tiempos",
  "food-cost": "Costo",
  leakage: "Fugas",
  staff: "Personal",
  accountant: "Contador",
  engineering: "Ingeniería",
  reservations: "Reservas",
  control: "Control",
};

export function ReportsView({
  section,
  status,
  onSection,
  onExport,
}: {
  section: ReportSection;
  status?: string;
  onSection: (section: ReportSection) => void;
  onExport: () => void;
}) {
  const model = reports[section];
  return (
    <RecordPage
      eyebrow={model.eyebrow}
      title={model.title}
      actions={[{ label: "Exportar", tone: "ghost", onPress: onExport }]}
      tabs={reportSections.map((id) => ({
        id,
        label: labels[id],
        active: id === section,
        onSelect: () => onSection(id),
      }))}
      metrics={model.metrics}
      columns={model.columns}
      rows={model.rows}
      caption={model.title}
      chart={model.chart ? <BarChart chart={model.chart} /> : undefined}
      note={model.note}
      status={status}
    />
  );
}
