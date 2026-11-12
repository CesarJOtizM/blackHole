import { type Cell, RecordPage } from "#src/shell/record-page.js";
import styles from "#src/styles/attendance.module.scss";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

const days = [
  "Lun 03",
  "Mar 04",
  "Mié 05",
  "Jue 06",
  "Vie 07",
  "Sáb 08",
  "Dom 09",
] as const;

const roster = [
  {
    name: "Luis Pérez",
    role: "Mesero",
    shifts: ["11–19", "11–19", "Libre", "15–23", "15–23", "15–23", "11–19"],
  },
  {
    name: "Ana Gómez",
    role: "Mesera",
    shifts: ["15–23", "Libre", "11–19", "11–19", "15–23", "15–23", "Libre"],
  },
  {
    name: "Marta Ruiz",
    role: "Cajera",
    shifts: ["11–19", "11–19", "11–19", "Libre", "11–19", "11–19", "11–19"],
  },
  {
    name: "Sofía León",
    role: "Supervisora",
    shifts: ["Libre", "15–23", "15–23", "15–23", "15–23", "15–23", "Libre"],
  },
  {
    name: "Pedro Mora",
    role: "Parrilla",
    shifts: ["10–18", "10–18", "10–18", "10–18", "Libre", "14–22", "14–22"],
  },
] as const;

export interface ScheduledPerson {
  name: string;
  role: string;
  shifts: string[];
}

export const openingRoster = (): ScheduledPerson[] =>
  roster.map((person) => ({
    name: person.name,
    role: person.role,
    shifts: [...person.shifts],
  }));

const summary = [
  { label: "Horas programadas", value: "1.012 h", detail: "Semana" },
  {
    label: "Cubrimiento viernes noche",
    value: "6 / 8",
    detail: "Faltan 2 meseros",
  },
  { label: "Horas extra previstas", value: "14 h", detail: "3 personas" },
] as const;

const rules = [
  ["Sin entrada no opera", "Todas las sedes", "Activa"],
  ["Foto al marcar", "Todas las sedes", "Activa"],
  ["Marcar sin horario", "Con aprobación", "Activa"],
  ["Llegada tarde", "Después de 10 min", "Activa"],
  ["Entrada antes del turno", "15 min", "Activa"],
  ["Salida automática", "2 h tras el turno", "Activa"],
  ["Salida olvidada", "El supervisor cierra el turno", "Activa"],
  ["Hora extra", "Se marca, no se paga sola", "Activa"],
] as const;

export function ScheduleView({
  people,
  onCopy,
  onPublish,
  onShift,
}: {
  people: readonly ScheduledPerson[];
  onCopy: () => void;
  onPublish: () => void;
  onShift: (name: string, dayIndex: number) => void;
}) {
  return (
    <RecordPage
      eyebrow="Semana 03–09 nov · Chapinero"
      title="Horarios"
      actions={[
        { label: "Copiar semana anterior", tone: "ghost", onPress: onCopy },
        { label: "Publicar", tone: "solid", onPress: onPublish },
      ]}
    >
      <div className={styles.grid}>
        <div className={styles.head}>
          <p className={styles.personHead}>Persona</p>
          {days.map((day) => (
            <p
              key={day}
              className={
                day === "Mié 05"
                  ? `${styles.dayHead} ${styles.dayGap}`
                  : styles.dayHead
              }
            >
              {day}
            </p>
          ))}
        </div>
        {people.map((person) => (
          <div key={person.name} className={styles.row}>
            <div className={styles.person}>
              <p className={styles.name}>{person.name}</p>
              <p className={styles.role}>{person.role}</p>
            </div>
            {person.shifts.map((shift, index) => (
              <button
                key={days[index]}
                type="button"
                className={shift === "Libre" ? styles.off : styles.shift}
                aria-label={`${person.name}, ${days[index]}, ${shift}. Cambiar turno`}
                onClick={() => onShift(person.name, index)}
              >
                {shift === "Libre" ? "Libre" : shift}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.summary}>
        {summary.map((item) => (
          <article key={item.label} className={styles.summaryCard}>
            <p className={styles.summaryLabel}>{item.label}</p>
            <p className={styles.summaryValue}>{item.value}</p>
            <p className={styles.summaryDetail}>{item.detail}</p>
          </article>
        ))}
      </div>
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
      eyebrow="Asistencia · ocho reglas"
      title="Reglas"
      actions={[{ label: "Guardar", tone: "solid", onPress: onSave }]}
      columns={["Regla", "Alcance", "Estado"]}
      rows={rules.map((row) => [row[0], row[1], { chip: row[2], tone: "go" }])}
      caption="Reglas de asistencia"
      note="Quien no marca entrada no abre caja, no toma pedidos y no envía a cocina."
      status={status}
    />
  );
}

const hours: Cell[][] = [
  ["Luis Pérez", "88 h", "96 h", "8 h", "1", { chip: "OK", tone: "go" }],
  ["Ana Gómez", "88 h", "88 h", "0 h", "0", { chip: "OK", tone: "go" }],
  ["Jorge Díaz", "88 h", "—", "—", "2", { chip: "Sin salida", tone: "stamp" }],
  ["Pedro Mora", "96 h", "101 h", "5 h", "0", { chip: "OK", tone: "go" }],
];

export function HoursView({
  status,
  exitAt,
  reason,
  onExitAt,
  onReason,
  onExport,
  onCorrect,
}: {
  status?: string;
  exitAt: string;
  reason: string;
  onExitAt: (value: string) => void;
  onReason: (value: string) => void;
  onExport: () => void;
  onCorrect: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Quincena 16–31 oct · 3 marcas por corregir"
      title="Horas trabajadas"
      actions={[{ label: "Exportar nómina", tone: "ghost", onPress: onExport }]}
      columns={[
        "Persona",
        "Programadas",
        "Trabajadas",
        "Extra",
        "Tarde",
        "Estado",
      ]}
      rows={hours}
      caption="Horas de la quincena"
      note="La marca original queda en la auditoría."
      status={status}
    >
      <article className={record.card}>
        <h2 className={record.cardTitle}>Jorge Díaz · 28 oct</h2>
        <p className={record.leadText}>Marcó entrada, no marcó salida</p>
        <p className={record.fact}>
          <span>Entrada</span> 14:58
        </p>
        <p className={record.fact}>
          <span>Última venta</span> 22:41
        </p>
        <p className={record.fact}>
          <span>Salida automática</span> 01:00
        </p>
        <form
          className={record.stack}
          onSubmit={(event) => {
            event.preventDefault();
            onCorrect();
          }}
        >
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Salida corregida</span>
            <input
              className={ui.input}
              value={exitAt}
              required
              onChange={(event) => onExitAt(event.target.value)}
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Motivo</span>
            <input
              className={ui.input}
              value={reason}
              required
              onChange={(event) => onReason(event.target.value)}
            />
          </label>
          <button type="submit" className={ui.button}>
            Guardar corrección
          </button>
        </form>
      </article>
    </RecordPage>
  );
}
