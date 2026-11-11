import { type Cell, RecordPage } from "#src/shell/record-page.js";
import ui from "#src/styles/ui.module.scss";

const week = [
  ["Lun 3", "10:00–18:00", "10:02", "18:11", "8 h 9 min"],
  ["Mar 4", "10:00–18:00", "10:00", "18:04", "8 h 4 min"],
  ["Mié 5", "Libre", "—", "—", "—"],
  ["Jue 6", "14:00–22:00", "13:54", "22:20", "8 h 26 min"],
  ["Vie 7", "14:00–22:00", "14:08", "22:01", "7 h 53 min"],
  ["Sáb 8", "12:00–20:00", "12:00", "Sin salida", "—"],
  ["Dom 9", "Libre", "—", "—", "—"],
] as const;

const rules = [
  ["Sin entrada no opera", "Caja, salón y cocina", "Activa"],
  ["Tolerancia de llegada", "10 minutos", "Activa"],
  ["Salida olvidada", "El supervisor cierra el turno", "Activa"],
  ["Hora extra", "Se marca, no se paga sola", "Activa"],
] as const;

export function ScheduleView({
  onRules,
  onHours,
}: {
  onRules: () => void;
  onHours: () => void;
}) {
  const rows: Cell[][] = week.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3] === "Sin salida" ? { chip: row[3], tone: "stamp" } : row[3],
    row[4],
  ]);
  return (
    <RecordPage
      eyebrow="Semana 03–09 nov · Chapinero"
      title="Horarios"
      columns={["Día", "Turno", "Entrada", "Salida", "Trabajado"]}
      rows={rows}
      caption="Horario de la semana"
      note="Jorge Díaz no tiene salida el sábado. Sin el cierre del supervisor, esas horas no entran a la quincena."
    >
      <button type="button" className={ui.textButton} onClick={onRules}>
        Reglas de asistencia
      </button>
      <button type="button" className={ui.textButton} onClick={onHours}>
        Horas de Jorge Díaz
      </button>
    </RecordPage>
  );
}

export function RulesView({
  status,
  onSave,
}: {
  status?: string;
  onSave: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Asistencia · reglas"
      title="Sin entrada no opera"
      actions={[{ label: "Guardar", tone: "solid", onPress: onSave }]}
      columns={["Regla", "Alcance", "Estado"]}
      rows={rules.map((row) => [row[0], row[1], { chip: row[2], tone: "go" }])}
      caption="Reglas de asistencia"
      note="Quien no marca entrada no abre caja, no toma pedidos y no envía a cocina."
      status={status}
    />
  );
}

export function HoursView({
  status,
  onClose,
  onExport,
}: {
  status?: string;
  onClose: () => void;
  onExport: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Jorge Díaz · mesero · Chapinero"
      title="Horas sin salida"
      actions={[
        { label: "Exportar nómina", tone: "ghost", onPress: onExport },
        { label: "Cerrar turno", tone: "solid", onPress: onClose },
      ]}
      columns={["Día", "Turno", "Entrada", "Salida", "Estado"]}
      rows={[
        [
          "Sáb 8 nov",
          "12:00–20:00",
          "12:00",
          "—",
          { chip: "Sin salida", tone: "stamp" },
        ],
      ]}
      caption="Turno abierto de Jorge Díaz"
      note="El supervisor escribe la hora real. El cierre queda en la auditoría de la sede."
      status={status}
    />
  );
}
