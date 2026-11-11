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

export function SetupView({
  status,
  onContinue,
}: {
  status?: string;
  onContinue: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Paso 3 de 6"
      title="Facturación"
      actions={[{ label: "Continuar", tone: "solid", onPress: onContinue }]}
      columns={["Dato", "Valor"]}
      rows={[
        ["Razón social", "La Parrilla SAS"],
        ["NIT", "901.112.334-5"],
        ["Régimen", "Común"],
        ["Responsable de INC", "Sí"],
        ["Proveedor", "Factus"],
      ]}
      caption="Datos de facturación"
      note="Faltan resoluciones, certificado y la primera sede. El alta no emite documentos todavía."
      status={status}
    />
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
      eyebrow="Soporte Blackhole"
      title="Acceso #4821"
      actions={[{ label: "Conceder 2 horas", tone: "solid", onPress: onGrant }]}
      metrics={[
        { label: "Caso", value: "#4821", detail: "Impresora de cocina" },
        {
          label: "Quién entra",
          value: "Mesa de soporte",
          detail: "Solo lectura de caja",
        },
        { label: "Sede", value: "Chapinero", detail: "La Parrilla SAS" },
        { label: "Vence", value: "2 horas", detail: "Queda en auditoría" },
      ]}
      note="El acceso no cambia precios, no anula cuentas y no ve la contraseña."
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

export function CaseView({
  status,
  onNote,
}: {
  status?: string;
  onNote: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Caso #4821 · Chapinero"
      title="Impresora EPSON"
      actions={[{ label: "Dejar nota", tone: "solid", onPress: onNote }]}
      columns={["Dato", "Valor"]}
      rows={[
        ["Equipo", "EPSON TM-T20"],
        ["Estación", "Parrilla"],
        ["Error", "ERR_PAPER_END"],
        ["Último ticket", "13:44"],
        ["Puente", "Conectado"],
      ]}
      caption="Caso de la impresora"
      note="El error dice que no hay papel. La comanda sigue en la pantalla de cocina."
      status={status}
    />
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
