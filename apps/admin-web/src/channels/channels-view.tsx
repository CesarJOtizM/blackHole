import { type Cell, RecordPage } from "#src/shell/record-page.js";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

const channels = [
  [
    "Domicilio propio",
    "Activo",
    "Teléfono y WhatsApp",
    "0%",
    "Carta base",
    "84",
  ],
  ["Rappi", "Activo", "Integración", "24%", "+12% sobre base", "61"],
  ["DiDi Food", "Activo", "Integración", "22%", "+10% sobre base", "61"],
  ["iFood", "Pausado", "Tablet del canal", "20%", "+10% sobre base", "61"],
] as const;

const products = [
  "Churrasco 400 g + Limonada",
  "Churrasco 400 g",
  "Limonada de coco",
  "Hamburguesa doble",
];

const initialMapping = [
  [
    "Combo Churrasco + Bebida",
    "Churrasco 400 g + Limonada",
    "$56.000",
    "$62.700",
    "Mapeado",
  ],
  ["Churrasco Premium", "Churrasco 400 g", "$44.000", "$49.300", "Mapeado"],
  ["Hamburguesa Doble", "", "—", "$38.900", "Sin mapear"],
  ["Papas Trufadas", "", "—", "$18.900", "Sin mapear"],
  ["Postre del día", "", "—", "$14.500", "Sin mapear"],
  ["Limonada de coco", "Limonada de coco", "$12.000", "$13.400", "Mapeado"],
] as const;

const differences = [
  [
    "RP-88213",
    "22 oct",
    "$64.000",
    "$0",
    "-$64.000",
    "Cancelado tras preparar",
    "Reclamar",
  ],
  [
    "RP-88240",
    "23 oct",
    "$49.300",
    "$24.650",
    "-$24.650",
    "Reembolso parcial",
    "Reclamar",
  ],
  [
    "RP-88301",
    "24 oct",
    "$112.000",
    "$112.000",
    "$0",
    "Comisión 26%",
    "Revisar",
  ],
  ["RP-88355", "26 oct", "$38.900", "$38.900", "$0", "—", "Cuadra"],
] as const;

export function ChannelsView({
  autoAccept,
  pauseKitchen,
  status,
  onAutoAccept,
  onPauseKitchen,
  onConnect,
  onOpenMapping,
  onOpenReconciliation,
}: {
  autoAccept: boolean;
  pauseKitchen: boolean;
  status?: string;
  onAutoAccept: (value: boolean) => void;
  onPauseKitchen: (value: boolean) => void;
  onConnect: () => void;
  onOpenMapping: () => void;
  onOpenReconciliation: () => void;
}) {
  const rows: Cell[][] = channels.map((row) => [
    row[0],
    { chip: row[1], tone: row[1] === "Activo" ? "go" : "hold" },
    row[2],
    row[3],
    row[4],
    row[5],
  ]);
  return (
    <RecordPage
      eyebrow="5 canales activos"
      title="Canales de venta"
      actions={[{ label: "Conectar canal", tone: "solid", onPress: onConnect }]}
      columns={[
        "Canal",
        "Estado",
        "Origen",
        "Comisión",
        "Precios",
        "Productos",
      ]}
      rows={rows}
      caption="Canales de venta"
      status={status}
      aside={
        <>
          <h2 className={record.cardTitle}>Rappi · configuración</h2>
          <p className={record.fact}>
            <span>Regla de precio</span>
            <strong>+12% sobre carta base</strong>
          </p>
          <p className={record.fact}>
            <span>Redondeo</span>
            <strong>A $100</strong>
          </p>
          <p className={record.fact}>
            <span>Tiempo de preparación</span>
            <strong>22 min</strong>
          </p>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>
              Aceptar pedidos automáticamente
            </span>
            <input
              type="checkbox"
              checked={autoAccept}
              onChange={(event) => onAutoAccept(event.target.checked)}
            />
          </label>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>
              Pausar si cocina supera 35 min
            </span>
            <input
              type="checkbox"
              checked={pauseKitchen}
              onChange={(event) => onPauseKitchen(event.target.checked)}
            />
          </label>
          <button
            type="button"
            className={ui.textButton}
            onClick={onOpenMapping}
          >
            Mapeo de productos
          </button>
          <button
            type="button"
            className={ui.textButton}
            onClick={onOpenReconciliation}
          >
            Conciliación
          </button>
        </>
      }
    />
  );
}

export function MappingView({
  assigned,
  status,
  onAssign,
  onPublish,
}: {
  assigned: Record<string, string>;
  status?: string;
  onAssign: (externalName: string, ownName: string) => void;
  onPublish: () => void;
}) {
  const rows: Cell[][] = initialMapping.map((row) => {
    const own = assigned[row[0]] ?? row[1];
    const mapped = own.length > 0;
    return [
      row[0],
      own.length > 0 ? own : "— elegir —",
      row[2],
      row[3],
      {
        chip: mapped ? "Mapeado" : "Sin mapear",
        tone: mapped ? "go" : "stamp",
      },
    ];
  });
  return (
    <RecordPage
      eyebrow="Rappi · 3 sin mapear"
      title="Mapeo de productos"
      actions={[{ label: "Publicar carta", tone: "solid", onPress: onPublish }]}
      columns={[
        "Producto en Rappi",
        "Producto propio",
        "Precio base",
        "Precio Rappi",
        "Estado",
      ]}
      rows={rows}
      caption="Mapeo Rappi"
      note="Un pedido con un producto sin mapear llega a la caja para revisión y no descuenta inventario."
      status={status}
    >
      {initialMapping
        .filter((row) => (assigned[row[0]] ?? row[1]).length === 0)
        .map((row) => (
          <label key={row[0]} className={ui.field}>
            <span className={ui.fieldLabel}>{row[0]}</span>
            <select
              className={ui.select}
              value=""
              onChange={(event) => onAssign(row[0], event.target.value)}
            >
              <option value="">— elegir —</option>
              {products.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
          </label>
        ))}
    </RecordPage>
  );
}

export function ReconciliationView({
  claimed,
  status,
  onClaim,
  onUpload,
  onExport,
}: {
  claimed: string[];
  status?: string;
  onClaim: (id: string) => void;
  onUpload: () => void;
  onExport: () => void;
}) {
  const rows: Cell[][] = differences.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
    row[5],
    {
      chip: claimed.includes(row[0]) ? "Reclamado" : row[6],
      tone: row[6] === "Cuadra" || claimed.includes(row[0]) ? "go" : "hold",
    },
  ]);
  return (
    <RecordPage
      eyebrow="Rappi · liquidación 21–27 oct"
      title="Conciliación"
      actions={[
        { label: "Subir liquidación", tone: "ghost", onPress: onUpload },
        { label: "Exportar", tone: "solid", onPress: onExport },
      ]}
      metrics={[
        {
          label: "Vendido según Blackhole",
          value: "$18,42 M",
          detail: "412 pedidos",
        },
        { label: "Comisión esperada", value: "$4,42 M", detail: "24%" },
        {
          label: "Pagado por Rappi",
          value: "$13,76 M",
          detail: "Consignado 30 oct",
        },
        { label: "Diferencia", value: "-$238.400", detail: "7 pedidos" },
      ]}
      columns={[
        "Pedido",
        "Fecha",
        "Rappi",
        "Pagado",
        "Diferencia",
        "Causa",
        "Acción",
      ]}
      rows={rows}
      caption="Diferencias de la liquidación"
      status={status}
    >
      {differences
        .filter((row) => row[6] === "Reclamar" && !claimed.includes(row[0]))
        .map((row) => (
          <button
            key={row[0]}
            type="button"
            className={ui.textButton}
            onClick={() => onClaim(row[0])}
          >
            Reclamar {row[0]}
          </button>
        ))}
    </RecordPage>
  );
}
