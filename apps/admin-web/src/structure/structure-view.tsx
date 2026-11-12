import type { ChipTone, RecordTab } from "#src/shell/record-page.js";
import { RecordPage } from "#src/shell/record-page.js";
import {
  brands,
  devices,
  hybridNodes,
  outages,
  registers,
  returnQueue,
  type StructureSection,
  stations,
  taxpayers,
  warehouses,
} from "#src/structure/structure-source.js";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

export function CompanyView({
  section,
  status,
  onSection,
  onCreateTaxpayer,
  onCreateBrand,
  onDevices,
  onHybrid,
}: {
  section: StructureSection;
  status?: string;
  onSection: (section: StructureSection) => void;
  onCreateTaxpayer: () => void;
  onCreateBrand: () => void;
  onDevices: () => void;
  onHybrid: () => void;
}) {
  const actions =
    section === "brands"
      ? [
          {
            label: "Nueva marca",
            tone: "solid" as const,
            onPress: onCreateBrand,
          },
        ]
      : section === "taxpayers"
        ? [
            {
              label: "Nuevo contribuyente",
              tone: "solid" as const,
              onPress: onCreateTaxpayer,
            },
          ]
        : [];

  return (
    <RecordPage
      eyebrow="Empresa · estructura"
      title="Estructura de la empresa"
      actions={actions}
      tabs={sectionTabs(section, onSection)}
      columns={section === "brands" ? undefined : columnsFor(section)}
      rows={section === "brands" ? [] : rowsFor(section)}
      caption="Estructura de la empresa"
      status={status}
    >
      {section === "brands" ? (
        <div className={record.attention}>
          {brands.map((brand) => (
            <article key={brand.name} className={record.card}>
              <h2 className={record.cardTitle}>{brand.name}</h2>
              <p className={record.fact}>
                <span>{brand.detail}</span>
              </p>
              <p className={record.fact}>
                <span>Se vende en</span>
                <strong>{brand.venues}</strong>
              </p>
            </article>
          ))}
        </div>
      ) : null}
      <button type="button" className={ui.textButton} onClick={onDevices}>
        Dispositivos
      </button>
      <button type="button" className={ui.textButton} onClick={onHybrid}>
        Modo híbrido
      </button>
    </RecordPage>
  );
}

export function VenueView({
  status,
  onSave,
}: {
  status?: string;
  onSave: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Sede · Cl 63 # 9-20 · La Parrilla"
      title="Chapinero"
      actions={[{ label: "Guardar", tone: "solid", onPress: onSave }]}
      columns={["Estación", "Categorías que recibe", "Pantalla", "Impresora"]}
      rows={stations.map((row) => [...row])}
      caption="Estaciones de cocina"
      note="Si se cae internet, la sede sigue con el nodo local."
      status={status}
      aside={
        <>
          <h2 className={record.cardTitle}>Modo de operación</h2>
          <p className={record.fact}>
            <span>Modo</span>
            <strong>Híbrido</strong>
          </p>
          <p className={record.fact}>
            <span>Nodo</span>
            <strong>Sano</strong>
          </p>
          <h2 className={record.cardTitle}>Cajas</h2>
          {registers.map((register) => (
            <p key={register[0]} className={record.fact}>
              <span>{register[0]}</span>
              <strong>{register[1]}</strong>
            </p>
          ))}
        </>
      }
    >
      <p className={ui.note}>
        Contribuyente La Parrilla SAS · 901.112.334-5. Dirección Calle 63 #
        9-20, Bogotá. Abre 11:30 y cierra 23:00.
      </p>
    </RecordPage>
  );
}

export function DevicesView({
  status,
  onGenerate,
}: {
  status?: string;
  onGenerate: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Estructura · dispositivos · Chapinero"
      title="Dispositivos de la sede"
      actions={[
        { label: "Generar QR de registro", tone: "solid", onPress: onGenerate },
      ]}
      columns={["Dispositivo", "Tipo", "Uso", "Última vez", "Estado"]}
      rows={devices.map((row) => [
        row[0],
        row[1],
        row[2],
        row[3],
        { chip: row[4], tone: row[4] === "Revocado" ? "stamp" : "go" },
      ])}
      caption="Dispositivos de Chapinero"
      status={status}
      aside={
        <>
          <p className={ui.eyebrow}>Código de un solo uso</p>
          <h2 className={record.cardTitle}>K7Q-4MZ</h2>
          <p className={record.fact}>
            <span>Sede</span>
            <strong>Chapinero</strong>
          </p>
          <p className={record.fact}>
            <span>Uso</span>
            <strong>Mesero</strong>
          </p>
          <p className={record.fact}>
            <span>Vence</span>
            <strong>En 9:42</strong>
          </p>
          <p className={ui.note}>
            Escanéalo desde el celular conectado al Wi-Fi de la sede.
          </p>
        </>
      }
    />
  );
}

export function HybridView({ onReturn }: { onReturn: () => void }) {
  return (
    <RecordPage
      eyebrow="Estructura · sedes · Chapinero · nodo"
      title="Modo híbrido"
      actions={[
        { label: "Volver a solo nube", tone: "ghost", onPress: onReturn },
      ]}
      metrics={[
        { label: "Estado del nodo", value: "Sano", detail: "latido hace 3 s" },
        {
          label: "Pendientes por subir",
          value: "0",
          detail: "última subida 14:31",
        },
        {
          label: "Dispositivos en el nodo",
          value: "6",
          detail: "de 7 registrados",
        },
        { label: "Respaldo local", value: "14:10", detail: "cada 20 min" },
      ]}
      columns={["Fecha", "Duración", "Operaciones", "Facturas", "Resultado"]}
      rows={outages.map((row) => [
        row[0],
        row[1],
        row[2],
        row[3],
        {
          chip: row[4],
          tone: row[4] === "Sin pérdidas" ? "go" : "stamp",
        },
      ])}
      caption="Cortes recientes"
      note="Operar sin internet cubre salón, cocina, caja y facturación en contingencia. Los pedidos QR quedan en cola."
      aside={
        <>
          <h2 className={record.cardTitle}>Emparejamiento del nodo</h2>
          <p className={record.fact}>
            <span>Equipo</span>
            <strong>NODO-CHP-01</strong>
          </p>
          <p className={record.fact}>
            <span>IP local</span>
            <strong>192.168.10.5</strong>
          </p>
          <p className={record.fact}>
            <span>Certificado local</span>
            <strong>Vence 03/2027</strong>
          </p>
          <p className={record.fact}>
            <span>Versión</span>
            <strong>2026.11.2</strong>
          </p>
        </>
      }
    >
      <NodeTable />
    </RecordPage>
  );
}

export function ReturnView({
  accept,
  reason,
  status,
  onAccept,
  onReason,
  onConfirm,
  onCancel,
}: {
  accept: boolean;
  reason: string;
  status?: string;
  onAccept: (value: boolean) => void;
  onReason: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Empresa / sedes / volver a nube"
      title="Volver a nube"
      actions={[
        { label: "Cancelar", tone: "ghost", onPress: onCancel },
        { label: "Confirmar vuelta a nube", tone: "solid", onPress: onConfirm },
      ]}
      columns={["Documento o evento", "Tipo", "Motivo si no sube", "Estado"]}
      rows={returnQueue.map((row) => [...row])}
      caption="Pendientes por subir"
      note="Una sede sin señal sigue vendiendo en híbrido. Sus eventos suben en orden cuando vuelve la conexión."
      status={status}
      aside={
        <>
          <h2 className={record.cardTitle}>Aceptar lo que no sube</h2>
          <p className={ui.note}>
            Los 2 eventos quedan en auditoría como no subidos. Requiere el PIN
            del administrador.
          </p>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Motivo registrado</span>
            <input
              className={ui.input}
              value={reason}
              onChange={(event) => onReason(event.target.value)}
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Acepto lo que no sube</span>
            <input
              type="checkbox"
              checked={accept}
              onChange={(event) => onAccept(event.target.checked)}
            />
          </label>
        </>
      }
    >
      <NodeTable />
    </RecordPage>
  );
}

function NodeTable() {
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <caption className="srOnly">Nodos</caption>
        <thead>
          <tr>
            <th>Nodo</th>
            <th>Estado</th>
            <th>Última señal</th>
            <th>Pendientes</th>
          </tr>
        </thead>
        <tbody>
          {hybridNodes.map((row) => (
            <tr key={row[0]}>
              <td>{row[0]}</td>
              <td>
                <span
                  className={row[1] === "En línea" ? ui.chipGo : ui.chipStamp}
                >
                  {row[1]}
                </span>
              </td>
              <td>{row[2]}</td>
              <td>{row[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sectionTabs(
  section: StructureSection,
  onSection: (section: StructureSection) => void,
): RecordTab[] {
  const items: Array<[StructureSection, string]> = [
    ["taxpayers", "Contribuyentes"],
    ["brands", "Marcas"],
    ["venues", "Sedes"],
    ["warehouses", "Bodegas"],
  ];
  return items.map(([id, label]) => ({
    id,
    label,
    active: section === id,
    onSelect: () => onSection(id),
  }));
}

function columnsFor(section: StructureSection): string[] {
  if (section === "warehouses") return ["Bodega", "Modo", "Alcance"];
  if (section === "venues") return ["Sede", "Contribuyente", "Modo"];
  if (section === "brands") return ["Marca", "Detalle", "Sedes"];
  return [
    "Razón social",
    "NIT",
    "Régimen",
    "Impuesto al consumo",
    "Sedes",
    "Factus",
  ];
}

function rowsFor(
  section: StructureSection,
): Array<Array<string | { chip: string; tone: ChipTone }>> {
  if (section === "warehouses") return warehouses.map((row) => [...row]);
  if (section === "venues") {
    return [
      ["Chapinero", "La Parrilla SAS", "Híbrido"],
      ["Usaquén", "La Parrilla SAS", "Nube"],
      ["Cedritos", "La Parrilla SAS", "Nube"],
      ["Salitre", "Burger Ember", "Nube"],
    ];
  }
  if (section === "brands") {
    return brands.map((brand) => [brand.name, brand.detail, brand.venues]);
  }
  return taxpayers.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
    { chip: row[5], tone: row[5] === "Habilitado" ? "go" : "hold" },
  ]);
}
