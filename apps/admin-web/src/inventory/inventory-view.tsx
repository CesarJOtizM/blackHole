import { useState } from "react";
import {
  type Cell,
  RecordPage,
  type RecordTab,
} from "#src/shell/record-page.js";
import record from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

type SupplyTab = "all" | "low" | "meat" | "dairy" | "drinks" | "packaging";

const supplies = [
  [
    "Churrasco (pieza)",
    "KG",
    "6,2",
    "12,0",
    "40,0",
    "$38.900",
    "Frigorífico Sab.",
    "Pedir",
    "meat",
    "low",
  ],
  [
    "Entraña",
    "KG",
    "0,0",
    "6,0",
    "20,0",
    "$41.200",
    "Frigorífico Sab.",
    "Agotado",
    "meat",
    "low",
  ],
  [
    "Papa criolla",
    "KG",
    "14,0",
    "20,0",
    "60,0",
    "$4.300",
    "Corabastos J.R.",
    "Pedir",
    "produce",
    "low",
  ],
  [
    "Queso doble crema",
    "KG",
    "3,1",
    "4,0",
    "12,0",
    "$22.500",
    "Alpina",
    "Pedir",
    "dairy",
    "low",
  ],
  [
    "Limón tahití",
    "KG",
    "9,0",
    "10,0",
    "30,0",
    "$3.800",
    "Corabastos J.R.",
    "Pedir",
    "drinks",
    "low",
  ],
  [
    "Caja domicilio",
    "UND",
    "140",
    "200",
    "800",
    "$1.150",
    "EmpaquesYa",
    "Pedir",
    "packaging",
    "low",
  ],
] as const;

const recipe = [
  ["Churrasco (pieza)", "0,400 KG", "8%", "$38.900", "$16.806"],
  ["Sal parrillera", "0,006 KG", "0%", "$9.000", "$54"],
  ["Chimichurri (sub-receta)", "0,030 KG", "0%", "$18.000", "$540"],
  ["Papa criolla", "0,180 KG", "12%", "$4.300", "$867"],
  ["Limón tahití", "0,020 KG", "0%", "$3.800", "$76"],
] as const;

const reception = [
  ["Churrasco (pieza)", "30,0 KG", "30,0 KG", "$38.900", "$38.900", "OK"],
  ["Entraña", "14,0 KG", "12,5 KG", "$41.200", "$41.200", "Falta"],
  ["Bife de chorizo", "10,0 KG", "10,0 KG", "$45.000", "$47.700", "+6%"],
] as const;

const consolidated = [
  ["Churrasco (pieza) KG", "84,0", "6,2", "18,4", "11,0", "9,8", "129,4"],
  ["Entraña KG", "22,0", "0,0", "7,5", "3,2", "4,0", "36,7"],
  ["Papa criolla KG", "120,0", "14,0", "31,0", "22,0", "18,0", "205,0"],
  ["Caja domicilio UND", "2.400", "140", "420", "310", "280", "3.550"],
] as const;

const transfers = [
  ["T-0112", "Bodega central", "Chapinero", "09:10", "En tránsito"],
  ["T-0109", "Bodega central", "Andrés Carne", "08:02", "Recibido"],
  ["T-0107", "Chapinero", "Bodega central", "Ayer", "Con diferencias"],
  ["T-0106", "Bodega central", "Chapinero", "Ayer", "Solicitado"],
] as const;

function supplyTone(label: string): "stamp" | "hold" {
  return label === "Agotado" ? "stamp" : "hold";
}

export function SuppliesView({
  tab,
  status,
  onTab,
  onImport,
  onCreate,
  onOrder,
  onRecipe,
  onPurchase,
  onConsolidated,
  onTransfers,
  onScarcity,
}: {
  tab: SupplyTab;
  status?: string;
  onTab: (tab: SupplyTab) => void;
  onImport: () => void;
  onCreate: () => void;
  onOrder: () => void;
  onRecipe: () => void;
  onPurchase: () => void;
  onConsolidated: () => void;
  onTransfers: () => void;
  onScarcity: () => void;
}) {
  const [items, setItems] = useState<string[][]>(() =>
    supplies.map((item) => [...item]),
  );
  const visible = items.filter((item) => {
    if (tab === "all") return true;
    if (tab === "low") return item[9] === "low";
    return item[8] === tab;
  });
  const rows: Cell[][] = visible.map((item) => [
    item[0],
    item[1],
    item[2],
    item[3],
    item[4],
    item[5],
    item[6],
    { chip: item[7], tone: supplyTone(item[7]) },
  ]);
  return (
    <RecordPage
      eyebrow="212 insumos · 9 bajo mínimo"
      title="Insumos"
      actions={[
        { label: "Importar Excel", tone: "ghost", onPress: onImport },
        {
          label: "Nuevo insumo",
          tone: "solid",
          onPress: () => {
            setItems((current) => [
              [
                "Insumo nuevo",
                "KG",
                "0",
                "1",
                "1",
                "$0",
                "Sin proveedor",
                "Pedir",
                "meat",
                "low",
              ],
              ...current,
            ]);
            onCreate();
          },
        },
      ]}
      tabs={supplyTabs(tab, onTab)}
      columns={[
        "Insumo",
        "Unidad",
        "Existencia",
        "Mínimo",
        "Máximo",
        "Costo prom.",
        "Proveedor",
        "Estado",
      ]}
      rows={rows}
      caption="Insumos"
      note="Pedido sugerido hasta el máximo: 3 proveedores · $2.184.000"
      status={status}
    >
      <button type="button" className={ui.button} onClick={onOrder}>
        Crear órdenes
      </button>
      <button type="button" className={ui.textButton} onClick={onRecipe}>
        Receta del churrasco
      </button>
      <button type="button" className={ui.textButton} onClick={onPurchase}>
        Orden OC-0418
      </button>
      <button type="button" className={ui.textButton} onClick={onConsolidated}>
        Consolidado
      </button>
      <button type="button" className={ui.textButton} onClick={onTransfers}>
        Traslados
      </button>
      <button type="button" className={ui.textButton} onClick={onScarcity}>
        Alertas de escasez
      </button>
    </RecordPage>
  );
}

export function RecipeView({
  status,
  onSave,
}: {
  status?: string;
  onSave: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Se descuenta al enviar a cocina"
      title="Receta: Churrasco 400 g"
      actions={[{ label: "Guardar", tone: "solid", onPress: onSave }]}
      columns={["Insumo", "Cantidad", "Merma", "Costo unit.", "Costo"]}
      rows={recipe.map((row) => [...row])}
      caption="Receta del churrasco"
      status={status}
      aside={
        <>
          <h2 className={record.cardTitle}>Costeo</h2>
          <p className={record.fact}>
            <span>Costo receta</span>
            <strong>$18.343</strong>
          </p>
          <p className={record.fact}>
            <span>Precio sin INC</span>
            <strong>$40.741</strong>
          </p>
          <p className={record.fact}>
            <span>Costo / precio</span>
            <strong>45%</strong>
          </p>
          <p className={record.fact}>
            <span>Meta de la marca</span>
            <strong>38%</strong>
          </p>
          <p className={ui.note}>
            Para llegar a 38%: precio con INC $52.100 o porción 0,340 KG.
          </p>
        </>
      }
    />
  );
}

export function PurchaseView({
  status,
  onReceive,
  onSend,
}: {
  status?: string;
  onReceive: () => void;
  onSend: () => void;
}) {
  const rows: Cell[][] = reception.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    row[4],
    { chip: row[5], tone: row[5] === "OK" ? "go" : "stamp" },
  ]);
  return (
    <RecordPage
      eyebrow="Frigorífico Sabana · entrega 06 nov 7:00"
      title="Orden OC-0418"
      actions={[
        { label: "Enviar por WhatsApp", tone: "ghost", onPress: onSend },
        { label: "Recibir mercancía", tone: "solid", onPress: onReceive },
      ]}
      columns={[
        "Insumo",
        "Pedido",
        "Recibido",
        "Precio pactado",
        "Precio factura",
        "Estado",
      ]}
      rows={rows}
      caption="Recepción de OC-0418"
      note="Al confirmar suben las existencias y el costo promedio. Foto de la factura FV-88213 adjunta."
      status={status}
      aside={
        <>
          <h2 className={record.cardTitle}>Resumen</h2>
          <p className={record.fact}>
            <span>Pedido</span>
            <strong>$2.211.800</strong>
          </p>
          <p className={record.fact}>
            <span>Recibido</span>
            <strong>$2.181.900</strong>
          </p>
          <p className={record.fact}>
            <span>Diferencia precio</span>
            <strong>+$27.000</strong>
          </p>
          <p className={record.fact}>
            <span>Vence</span>
            <strong>06 dic</strong>
          </p>
        </>
      }
    />
  );
}

export function ConsolidatedView({ onTransfer }: { onTransfer: () => void }) {
  return (
    <RecordPage
      eyebrow="4 sedes + bodega general"
      title="Inventario consolidado"
      actions={[
        { label: "Nuevo traslado", tone: "solid", onPress: onTransfer },
      ]}
      metrics={[
        {
          label: "Valor en inventario",
          value: "$48,2 M",
          detail: "+3% semana",
        },
        { label: "Bajo mínimo", value: "23", detail: "En 3 sedes" },
        { label: "Traslados en camino", value: "2", detail: "Bodega → sedes" },
        {
          label: "Diferencia de conteo",
          value: "-1,8%",
          detail: "Último cierre",
        },
      ]}
      columns={[
        "Insumo",
        "Bodega",
        "Chapinero",
        "Usaquén",
        "Cedritos",
        "Salitre",
        "Total",
      ]}
      rows={consolidated.map((row) => [...row])}
      caption="Inventario consolidado"
      note="TR-0091 · Bodega → Chapinero · Entraña 8,0 KG · Salió 13:30 · En camino"
    />
  );
}

export function TransfersView({
  status,
  onOpen,
  onCreate,
}: {
  status?: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const rows: Cell[][] = transfers.map((row) => [
    row[0],
    row[1],
    row[2],
    row[3],
    {
      chip: row[4],
      tone:
        row[4] === "Recibido"
          ? "go"
          : row[4] === "Con diferencias"
            ? "stamp"
            : "hold",
    },
  ]);
  return (
    <RecordPage
      eyebrow="Inventario central / traslados"
      title="Traslados"
      actions={[{ label: "Nuevo traslado", tone: "solid", onPress: onCreate }]}
      columns={["Traslado", "Origen", "Destino", "Creado", "Estado"]}
      rows={rows}
      caption="Traslados"
      status={status}
    >
      <button
        type="button"
        className={ui.textButton}
        onClick={() => onOpen("T-0112")}
      >
        Abrir T-0112
      </button>
    </RecordPage>
  );
}

export function TransferDetailView({
  status,
  onPrint,
}: {
  status?: string;
  onPrint: () => void;
}) {
  return (
    <RecordPage
      eyebrow="Traslado T-0112"
      title="Bodega central a Chapinero"
      actions={[
        { label: "Imprimir comprobante", tone: "ghost", onPress: onPrint },
      ]}
      columns={[
        "Insumo",
        "Cantidad",
        "Costo que viaja",
        "Despachado",
        "Recibido",
      ]}
      rows={[
        [
          "Salsa criolla base",
          "2 L",
          "$13.700",
          "Laura R. · 09:24",
          "Pendiente",
        ],
      ]}
      caption="Detalle de T-0112"
      note="El destino aún no recibe. Si llega con diferencia, el punto escribe el motivo y el administrador decide. Si la sede estaba sin internet, la recepción llega por QR."
      status={status}
    />
  );
}

function supplyTabs(
  tab: SupplyTab,
  onTab: (tab: SupplyTab) => void,
): RecordTab[] {
  const items: Array<[SupplyTab, string]> = [
    ["all", "Todos"],
    ["low", "Bajo mínimo · 9"],
    ["meat", "Carnes"],
    ["dairy", "Lácteos"],
    ["drinks", "Bebidas"],
    ["packaging", "Desechables"],
  ];
  return items.map(([id, label]) => ({
    id,
    label,
    active: tab === id,
    onSelect: () => onTab(id),
  }));
}
