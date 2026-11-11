import { useState } from "react";
import { type Cell, RecordPage } from "#src/shell/record-page.js";
import record from "#src/styles/record.module.scss";

const events = [
  [
    "14:12",
    "Descuento 25% mesa 08",
    "Marta R.",
    "Sofía L.",
    "$99.500",
    "Cel Sofía",
  ],
  [
    "13:58",
    "Anular churrasco mesa 02",
    "Luis P.",
    "Sofía L.",
    "$44.000",
    "Cel Luis",
  ],
  [
    "13:15",
    "Egreso compra de hielo",
    "Marta R.",
    "—",
    "$24.000",
    "Tablet caja 1",
  ],
  ["12:47", "Cajón sin venta", "Marta R.", "—", "—", "Tablet caja 1"],
  ["12:02", "Apertura de turno", "Marta R.", "—", "$200.000", "Tablet caja 1"],
] as const;

export function AuditView({
  onExport,
  status,
}: {
  onExport: () => void;
  status?: string;
}) {
  const [selected, setSelected] = useState(0);
  const current = events[selected] ?? events[0];
  const rows: Cell[][] = events.map((event) => [...event]);

  return (
    <RecordPage
      eyebrow="Solo lectura · nada se borra"
      title="Auditoría"
      actions={[{ label: "Exportar", tone: "ghost", onPress: onExport }]}
      columns={["Hora", "Evento", "Pidió", "Autorizó", "Valor", "Dispositivo"]}
      rows={rows}
      caption="Eventos de auditoría"
      status={status}
      note="Fecha 05 nov 2026 · sede Chapinero · tipo Autorizaciones. Inmutable."
      aside={
        <>
          <p className={record.metricLabel}>Evento {current[0]}</p>
          <h2 className={record.cardTitle}>{current[1]}</h2>
          <p className={record.fact}>
            <span>Pidió</span>
            <strong>{current[2]}</strong>
          </p>
          <p className={record.fact}>
            <span>Autorizó</span>
            <strong>{current[3]}</strong>
          </p>
          <p className={record.fact}>
            <span>Valor</span>
            <strong>{current[4]}</strong>
          </p>
          <p className={record.fact}>
            <span>Antes</span>
            <strong>$398.000</strong>
          </p>
          <p className={record.fact}>
            <span>Después</span>
            <strong>$298.500</strong>
          </p>
          <p className={record.fact}>
            <span>Aprobado</span>
            <strong>Remoto · PIN</strong>
          </p>
          <button
            type="button"
            className={record.attentionItem}
            onClick={() => setSelected((index) => (index + 1) % events.length)}
          >
            <strong>Siguiente evento</strong>
            <span>La cadena no se edita ni se borra.</span>
          </button>
        </>
      }
    />
  );
}
