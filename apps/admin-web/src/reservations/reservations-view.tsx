import { RecordPage } from "#src/shell/record-page.js";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

const slots = [
  ["12:00 – 15:30", "Lun – dom", "8 de 14", "40", "90 min"],
  ["18:00 – 20:00", "Mar – sáb", "10 de 14", "48", "120 min"],
  ["20:00 – 22:30", "Vie – sáb", "6 de 14", "30", "120 min"],
  ["Cumpleaños 10+", "Sáb", "2 salones", "30", "180 min"],
] as const;

const accounts = [
  ["Bancolombia", "Ahorros", "•• 4417", "Anticipo de reserva", "Activa"],
  ["Nequi", "Celular", "•• 9021", "Anticipo de reserva", "Activa"],
  ["Bre-B", "Llave", "reservas@laparrilla.co", "Anticipo de reserva", "Activa"],
] as const;

const policy = [
  [
    "Más de 48 h",
    "100%",
    "Transferencia con comprobante",
    "Quien tiene el permiso",
  ],
  [
    "Entre 24 y 48 h",
    "50%",
    "Transferencia con comprobante",
    "Administrador de sede",
  ],
  ["Menos de 24 h", "0% (se retiene)", "No aplica", "—"],
] as const;

export interface VenuePolicy {
  depositFrom: string;
  depositAmount: string;
  appliedToAccount: string;
  freeCancel: string;
  noShow: string;
  releaseTable: string;
}

export function SlotsView({
  status,
  policy,
  onSave,
  onAccounts,
  onPolicy,
}: {
  status?: string;
  policy: VenuePolicy;
  onSave: () => void;
  onAccounts: () => void;
  onPolicy: () => void;
}) {
  const rules = [
    ["Anticipo desde", policy.depositFrom],
    ["Valor del anticipo", policy.depositAmount],
    ["Se abona a la cuenta", policy.appliedToAccount],
    ["Cancelar sin costo", policy.freeCancel],
    ["No llega", policy.noShow],
    ["Se libera la mesa", policy.releaseTable],
    ["Confirmar automáticamente", "Sin anticipo y con cupo"],
    ["Recordatorio por WhatsApp", "24 h y 2 h antes"],
  ] as const;

  return (
    <RecordPage
      eyebrow="Lo que se ofrece en la página pública"
      title="Capacidad y franjas"
      actions={[{ label: "Guardar", tone: "solid", onPress: onSave }]}
      columns={[
        "Franja",
        "Días",
        "Mesas en línea",
        "Personas máx.",
        "Duración",
      ]}
      rows={slots.map((row) => [...row])}
      caption="Capacidad y franjas"
      status={status}
    >
      <section className={record.policy} aria-label="Políticas">
        <h2 className={record.policyTitle}>Políticas</h2>
        {rules.map(([label, value]) => (
          <p key={label} className={record.policyItem}>
            <span>{label}</span>
            <strong>{value}</strong>
          </p>
        ))}
      </section>
      <button type="button" className={ui.textButton} onClick={onAccounts}>
        Cuentas de anticipo
      </button>
      <button type="button" className={ui.textButton} onClick={onPolicy}>
        Editar políticas
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
      eyebrow="Sede Chapinero"
      title="Tramos de cancelación"
      actions={[{ label: "Guardar política", tone: "solid", onPress: onSave }]}
      columns={["Anticipación", "Devolución", "Forma", "Aprueba"]}
      rows={policy.map((row) => [...row])}
      caption="Tramos de cancelación"
      note="Pasados 15 minutos sin llegada, el cobro se retiene. La devolución por transferencia exige autorización y queda auditada con el motivo y el valor."
      status={status}
    />
  );
}
