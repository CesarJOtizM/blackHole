import { type Cell, RecordPage } from "#src/shell/record-page.js";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

const resolutions = [
  [
    "FECH",
    "Factura electrónica",
    "Chapinero",
    "1 – 50.000",
    "41.382",
    "12 feb 2027",
    "83% usado",
  ],
  [
    "FEUS",
    "Factura electrónica",
    "Usaquén",
    "1 – 50.000",
    "12.904",
    "12 feb 2027",
    "Vigente",
  ],
  [
    "POCH",
    "Documento POS",
    "Chapinero",
    "1 – 100.000",
    "88.120",
    "28 nov 2026",
    "Vence en 23 d",
  ],
  [
    "CTCH",
    "Contingencia",
    "Chapinero",
    "1 – 5.000",
    "214",
    "12 feb 2027",
    "Vigente",
  ],
  [
    "NCCH",
    "Nota crédito",
    "Chapinero",
    "1 – 10.000",
    "603",
    "12 feb 2027",
    "Vigente",
  ],
] as const;

const documents = [
  [
    "FECH-41380",
    "14:02",
    "Chapinero",
    "Constructora Andes",
    "$486.000",
    "Rechazado",
  ],
  ["FECH-41377", "13:51", "Chapinero", "Juan Torres", "$132.000", "Rechazado"],
  [
    "FEUS-12899",
    "13:20",
    "Usaquén",
    "Soluciones Kappa",
    "$74.500",
    "Rechazado",
  ],
] as const;

const balanceRows = [
  ["Chapinero", "9.210", "7.402", "88", "16.700", "40%"],
  ["Usaquén", "6.430", "4.910", "41", "11.381", "28%"],
  ["Cedritos", "4.120", "3.880", "20", "8.020", "19%"],
  ["Salitre", "2.904", "2.330", "25", "5.259", "13%"],
] as const;

function toneFor(label: string): "go" | "stamp" | "hold" {
  if (label === "Vigente") return "go";
  if (label === "Rechazado" || label.startsWith("Vence")) return "stamp";
  return "hold";
}

export function TaxProfileView({
  onCreate,
  onDocuments,
  onBalance,
  status,
}: {
  onCreate: () => void;
  onDocuments: () => void;
  onBalance: () => void;
  status?: string;
}) {
  const rows: Cell[][] = resolutions.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
    row[5],
    { chip: row[6], tone: toneFor(row[6]) },
  ]);
  return (
    <RecordPage
      eyebrow="NIT 901.234.567-8 · responsable de INC"
      title="Perfil tributario"
      actions={[
        { label: "Nueva resolución", tone: "solid", onPress: onCreate },
      ]}
      metrics={[
        { label: "Régimen", value: "Común", detail: "IVA + INC 8%" },
        {
          label: "Proveedor tecnológico",
          value: "Conectado",
          detail: "Prueba OK 04 nov",
        },
        { label: "Refacturación", value: "Mismo mes", detail: "Cierra 30 nov" },
        {
          label: "Certificado",
          value: "312 días",
          detail: "Vence 13 sep 2027",
        },
      ]}
      columns={[
        "Prefijo",
        "Tipo",
        "Sede",
        "Rango",
        "Usados",
        "Vence",
        "Estado",
      ]}
      rows={rows}
      caption="Resoluciones"
      note="La resolución POCH vence el 28 nov. Sin una nueva, Chapinero no podrá emitir documento POS."
      status={status}
    >
      <button type="button" className={ui.textButton} onClick={onDocuments}>
        Documentos rechazados
      </button>
      <button type="button" className={ui.textButton} onClick={onBalance}>
        Saldo de documentos
      </button>
    </RecordPage>
  );
}

export function DocumentsView({
  nit,
  status,
  onNit,
  onResend,
  onConsumer,
}: {
  nit: string;
  status?: string;
  onNit: (value: string) => void;
  onResend: () => void;
  onConsumer: () => void;
}) {
  const rows: Cell[][] = documents.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
    { chip: row[5], tone: "stamp" },
  ]);
  return (
    <RecordPage
      eyebrow="Hoy · 1.284 emitidos"
      title="Documentos ante la DIAN"
      actions={[
        { label: "Reintentar pendientes", tone: "solid", onPress: onResend },
      ]}
      metrics={[
        { label: "Rechazados", value: "3", detail: "Requieren corrección" },
        { label: "Pendientes", value: "12", detail: "En cola" },
        { label: "Contingencia", value: "4", detail: "Por transmitir" },
        { label: "Aceptados", value: "1.265", detail: "Hoy" },
      ]}
      columns={["Número", "Hora", "Sede", "Cliente", "Total", "Estado"]}
      rows={rows}
      caption="Documentos rechazados"
      status={status}
      aside={
        <>
          <p className={ui.eyebrow}>FECH-41380</p>
          <h2 className={record.cardTitle}>Rechazada por la DIAN</h2>
          <p className={ui.note}>
            FAK24 · NIT del adquirente. El dígito de verificación no corresponde
            al NIT 900.456.123.
          </p>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Corregir NIT</span>
            <input
              className={ui.input}
              value={nit}
              onChange={(event) => onNit(event.target.value)}
            />
          </label>
          <button type="button" className={ui.button} onClick={onResend}>
            Corregir y reenviar
          </button>
          <button type="button" className={ui.buttonGhost} onClick={onConsumer}>
            Emitir a consumidor final
          </button>
          <p className={ui.note}>Se puede refacturar hasta el 30 nov.</p>
        </>
      }
    />
  );
}

export function BalanceView({
  onBuy,
  status,
}: {
  onBuy: () => void;
  status?: string;
}) {
  return (
    <RecordPage
      eyebrow="Paquete del proveedor tecnológico"
      title="Saldo de documentos"
      actions={[{ label: "Comprar paquete", tone: "solid", onPress: onBuy }]}
      metrics={[
        { label: "Disponibles", value: "8.640", detail: "de 50.000" },
        { label: "Uso diario", value: "1.310", detail: "Promedio 30 días" },
        { label: "Alcanza para", value: "6 días", detail: "Hasta el 11 nov" },
        { label: "Alerta en", value: "5.000", detail: "Correo y aviso" },
      ]}
      columns={[
        "Sede",
        "Facturas",
        "POS",
        "Notas",
        "Total mes",
        "Participación",
      ]}
      rows={balanceRows.map((row) => [...row])}
      caption="Consumo del paquete por sede"
      note="41.360 usados · 8.640 disponibles."
      status={status}
    />
  );
}
