import { type Cell, RecordPage } from "#src/shell/record-page.js";
import ui from "#src/styles/ui.module.scss";

const slots = [
  ["Almuerzo", "12:00–15:30", "45 min", "14 mesas", "Activa"],
  ["Comida", "18:30–22:30", "90 min", "14 mesas", "Activa"],
  ["Domingo", "12:00–16:00", "75 min", "10 mesas", "Activa"],
] as const;

const accounts = [
  ["Bancolombia", "Ahorros", "•• 4417", "Anticipo de reserva", "Activa"],
  ["Nequi", "Celular", "•• 9021", "Anticipo de reserva", "Activa"],
  ["Bre-B", "Llave", "reservas@laparrilla.co", "Anticipo de reserva", "Activa"],
] as const;

const policy = [
  ["Más de 48 h", "100%", "Se devuelve el anticipo"],
  ["Entre 24 y 48 h", "50%", "Se retiene la mitad"],
  ["Menos de 24 h", "0%", "No se devuelve"],
] as const;

export function SlotsView({
  onAccounts,
  onPolicy,
}: {
  onAccounts: () => void;
  onPolicy: () => void;
}) {
  const rows: Cell[][] = slots.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    { chip: row[4], tone: "go" },
  ]);
  return (
    <RecordPage
      eyebrow="Reservas · Chapinero"
      title="Franjas"
      columns={["Franja", "Horario", "Duración", "Cupo", "Estado"]}
      rows={rows}
      caption="Franjas de reserva"
      note="La reserva conserva la política de cancelación con la que se creó."
    >
      <button type="button" className={ui.textButton} onClick={onAccounts}>
        Cuentas de anticipo
      </button>
      <button type="button" className={ui.textButton} onClick={onPolicy}>
        Política de cancelación
      </button>
    </RecordPage>
  );
}

export function AccountsView({
  status,
  onSave,
}: {
  status?: string;
  onSave: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Reservas · anticipos"
      title="Cuentas"
      actions={[{ label: "Guardar", tone: "solid", onPress: onSave }]}
      columns={["Medio", "Tipo", "Destino", "Uso", "Estado"]}
      rows={accounts.map((row) => [
        row[0],
        row[1],
        row[2],
        row[3],
        { chip: row[4], tone: "go" },
      ])}
      caption="Cuentas de anticipo"
      note="El anticipo no es ingreso de venta. Entra a la reserva y se aplica al llegar."
      status={status}
    />
  );
}

export function CancellationView({
  status,
  onSave,
}: {
  status?: string;
  onSave: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Reservas · política vigente"
      title="Cancelación"
      actions={[{ label: "Guardar", tone: "solid", onPress: onSave }]}
      columns={["Antelación", "Devolución", "Efecto"]}
      rows={policy.map((row) => [...row])}
      caption="Política de cancelación"
      note="Una reserva ya creada no cambia de política si esta tabla se edita después."
      status={status}
    />
  );
}
