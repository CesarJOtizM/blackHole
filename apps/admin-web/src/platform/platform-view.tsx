import { type Cell, RecordPage } from "#src/shell/record-page.js";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

const companies = [
  ["La Parrilla SAS", "901.112.334-5", "Cadena", "Al día"],
  ["Parrilla Norte", "901.880.221-1", "Cadena", "NIT en revisión"],
  ["Burger Ember", "900.441.778-2", "Una sede", "Al día"],
] as const;

export function PlanView({
  onSetup,
  onSupport,
  onBag,
  onFactus,
}: {
  onSetup: () => void;
  onSupport: () => void;
  onBag: () => void;
  onFactus: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Plan cadena · 4 sedes"
      title="Plan"
      metrics={[
        { label: "Sede", value: "$159.000", detail: "× 4 sedes" },
        { label: "Nodo híbrido", value: "$60.000", detail: "Chapinero" },
        { label: "Total mes", value: "$696.000", detail: "Antes de IVA" },
        {
          label: "Medio de pago",
          value: "Visa •• 4417",
          detail: "Vence 08/28",
        },
      ]}
      note="La bolsa de documentos se cobra aparte, cuando se compra."
    >
      <button type="button" className={ui.textButton} onClick={onSetup}>
        Alta de facturación
      </button>
      <button type="button" className={ui.textButton} onClick={onSupport}>
        Acceso de soporte
      </button>
      <button type="button" className={ui.textButton} onClick={onBag}>
        Bolsa de documentos
      </button>
      <button type="button" className={ui.textButton} onClick={onFactus}>
        Requisitos de Factus
      </button>
    </RecordPage>
  );
}

const setupSteps = [
  { label: "Empresa y NIT", mark: "✓", state: "done" },
  { label: "Sedes y marcas", mark: "✓", state: "done" },
  { label: "Facturación electrónica", mark: "3", state: "current" },
  { label: "Carta", mark: "4", state: "later" },
  { label: "Personas y PIN", mark: "5", state: "later" },
  { label: "Dispositivos", mark: "6", state: "later" },
] as const;

const resolution = [
  ["NIT", "901.234.567-8"],
  ["Prefijo", "FECH"],
  ["Resolución", "18764000001234"],
  ["Desde", "1"],
  ["Hasta", "50.000"],
  ["Vence", "12 feb 2027"],
] as const;

export function SetupView({
  status,
  onBack,
  onLater,
  onContinue,
}: {
  status?: string;
  onBack: () => void;
  onLater: () => void;
  onContinue: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Paso 3 de 6 · te faltan 12 minutos"
      title="Configura tu restaurante"
      actions={[
        { label: "Atrás", tone: "ghost", onPress: onBack },
        { label: "Hacerlo después", tone: "ghost", onPress: onLater },
        { label: "Siguiente: carta", tone: "solid", onPress: onContinue },
      ]}
      aside={
        <ol className={record.steps}>
          {setupSteps.map((step) => (
            <li
              key={step.label}
              className={
                step.state === "current"
                  ? record.stepCurrent
                  : step.state === "done"
                    ? record.step
                    : record.stepLater
              }
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <span className={record.stepMark}>{step.mark}</span>
              {step.label}
            </li>
          ))}
        </ol>
      }
      note="Factura de prueba aceptada por la DIAN · CUFE 8f3a…c21"
      status={status}
    >
      <p className={record.lead}>Paso 3 · facturación electrónica</p>
      <p className={record.leadText}>Conecta tu facturación con la DIAN</p>
      <p className={record.leadText}>
        Necesitas la resolución de numeración y haber habilitado a Blackhole
        como proveedor tecnológico en el portal de la DIAN.
      </p>
      {resolution.map(([label, value]) => (
        <p key={label} className={record.fact}>
          <span>{label}</span> {value}
        </p>
      ))}
    </RecordPage>
  );
}

export function SupportView({
  status,
  onGrant,
  onCompanies,
  onCase,
}: {
  status?: string;
  onGrant: () => void;
  onCompanies: () => void;
  onCase: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Nadie de Blackhole entra a tus datos sin tu permiso"
      title="Acceso de soporte"
      actions={[{ label: "Conceder acceso", tone: "solid", onPress: onGrant }]}
      columns={["Caso", "Agente", "Vence", "Estado"]}
      rows={[
        ["#4821", "Daniel (soporte)", "18:20", { chip: "Activo", tone: "go" }],
        [
          "#4790",
          "Laura (soporte)",
          "31 oct",
          { chip: "Vencido", tone: "hold" },
        ],
        [
          "#4712",
          "Daniel (soporte)",
          "22 oct",
          { chip: "Revocado", tone: "stamp" },
        ],
      ]}
      caption="Accesos de soporte"
      note="El caso #4821 es la caja de Usaquén que no imprime. Alcance solo Usaquén, 4 horas, solo lectura. Los nombres, teléfonos y documentos quedan ocultos, y cada acción avisa por correo."
      status={status}
    >
      <button type="button" className={ui.textButton} onClick={onCompanies}>
        Empresas en soporte
      </button>
      <button type="button" className={ui.textButton} onClick={onCase}>
        Ver caso #4821
      </button>
    </RecordPage>
  );
}

export function CompaniesView() {
  const rows: Cell[][] = companies.map((row) => [
    row[0],
    row[1],
    row[2],
    { chip: row[3], tone: row[3] === "Al día" ? "go" : "hold" },
  ]);
  return (
    <RecordPage
      eyebrow="Backoffice · no sale en el menú del cliente"
      title="Empresas"
      columns={["Empresa", "NIT", "Plan", "Estado"]}
      rows={rows}
      caption="Empresas en soporte"
    />
  );
}

const printerLog = [
  "14:02:11  Envío comanda #8812  OK",
  "14:05:40  Envío factura FEUS-12901  ERR_PAPER_END",
  "14:05:41  Reintento 1/3  ERR_PAPER_END",
  "14:06:02  Cola local: 2 documentos",
] as const;

export interface CaseMessage {
  who: string;
  text: string;
}

export function CaseView({
  status,
  messages,
  reply,
  onReply,
  onSend,
  onClose,
}: {
  status?: string;
  messages: readonly CaseMessage[];
  reply: string;
  onReply: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <RecordPage
      eyebrow="La Parrilla SAS · Usaquén · acceso concedido hasta 18:20"
      title="Caso #4821"
      actions={[{ label: "Cerrar caso", tone: "solid", onPress: onClose }]}
      columns={[
        "Dispositivo",
        "Versión",
        "Última señal",
        "Impresora",
        "Estado",
      ]}
      rows={[
        [
          "Tablet caja 1",
          "4.12.0",
          "Hace 4 s",
          "EPSON TM-T20",
          { chip: "Error papel", tone: "stamp" },
        ],
        [
          "Tablet cocina",
          "4.12.0",
          "Hace 2 s",
          "STAR TSP143",
          { chip: "OK", tone: "go" },
        ],
        [
          "Celular Luis",
          "4.11.2",
          "Hace 9 s",
          "—",
          { chip: "Actualizar", tone: "hold" },
        ],
      ]}
      caption="Dispositivos de la sede"
      note="Estás viendo datos del cliente en solo lectura. Cada acción queda en su auditoría y le llega por correo."
      status={status}
    >
      <h2 className={record.logTitle}>Registro de la impresora</h2>
      <ul className={record.log}>
        {printerLog.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <h2 className={record.logTitle}>Conversación</h2>
      <ul className={record.thread}>
        {messages.map((message) => (
          <li key={`${message.who}-${message.text}`}>
            <p className={record.who}>{message.who}</p>
            <p>{message.text}</p>
          </li>
        ))}
      </ul>
      <form
        className={record.reply}
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Responder</span>
          <input
            className={ui.input}
            value={reply}
            placeholder="Escribe un mensaje…"
            onChange={(event) => onReply(event.target.value)}
          />
        </label>
        <button type="submit" className={ui.button}>
          Responder
        </button>
      </form>
    </RecordPage>
  );
}

export function BagView({
  status,
  onBuy,
  onEmpty,
  onSuspended,
}: {
  status?: string;
  onBuy: () => void;
  onEmpty: () => void;
  onSuspended: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Bolsa de documentos"
      title="Saldo"
      actions={[{ label: "Comprar 50.000", tone: "solid", onPress: onBuy }]}
      metrics={[
        { label: "Disponibles", value: "14", detail: "de la bolsa actual" },
        { label: "Alcance", value: "6 días", detail: "al ritmo de hoy" },
        { label: "Alerta", value: "5.000", detail: "ya se pasó" },
        { label: "Uso de hoy", value: "1.310", detail: "facturas y notas" },
      ]}
      note="14 documentos alcanzan unas horas de servicio, no seis días de operación normal."
      status={status}
    >
      <button type="button" className={ui.textButton} onClick={onEmpty}>
        Ver saldo en cero
      </button>
      <button type="button" className={ui.textButton} onClick={onSuspended}>
        Ver suscripción suspendida
      </button>
    </RecordPage>
  );
}

export function EmptyBagView() {
  return (
    <RecordPage
      eyebrow="Bolsa agotada"
      title="Saldo cero"
      metrics={[
        { label: "Documentos", value: "0", detail: "No hay saldo" },
        {
          label: "Venta en caja",
          value: "Sigue",
          detail: "La cuenta se puede cobrar",
        },
        {
          label: "Factura",
          value: "Pendiente",
          detail: "Se emite al recargar",
        },
        { label: "Alerta", value: "En caja", detail: "Antes de cobrar" },
      ]}
      note="Con saldo cero la venta sigue. La factura queda pendiente hasta que haya documentos."
    />
  );
}

export function SuspendedView() {
  return (
    <RecordPage
      eyebrow="Suscripción"
      title="Suspendida por falta de pago"
      aside={
        <>
          <h2 className={record.cardTitle}>Pendiente de decidir</h2>
          <p className={ui.note}>
            Qué puede hacer una sede suspendida todavía no está cerrado. Esta
            pantalla no inventa permisos de caja, cocina ni factura.
          </p>
        </>
      }
    >
      <p className={ui.note}>
        El cobro de noviembre no pasó en Visa •• 4417. El plan cadena sigue
        marcado como suspendido hasta que el pago se confirme.
      </p>
    </RecordPage>
  );
}
