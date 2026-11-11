import { useState } from "react";
import type { DiningTable, DiningZone } from "#src/catalog/source/types.js";
import styles from "#src/styles/catalog/tables.module.scss";
import ui from "#src/styles/ui.module.scss";

export interface TablesViewProps {
  zoneName: string;
  tableCount: number;
  zones: DiningZone[];
  zoneId: string;
  tables: DiningTable[];
  selected: DiningTable | undefined;
  addPending: boolean;
  onZone: (zoneId: string) => void;
  onSelect: (tableId: string) => void;
  onAdd: () => void;
  onRegenerate: (tableId: string) => void;
}

export function TablesView({
  zoneName,
  tableCount,
  zones,
  zoneId,
  tables,
  selected,
  addPending,
  onZone,
  onSelect,
  onAdd,
  onRegenerate,
}: TablesViewProps) {
  const [notice, setNotice] = useState("");

  return (
    <div className={styles.content}>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>
            {zoneName} · {tableCount} mesas
          </p>
          <h1 className={ui.title}>Plano y QR</h1>
        </div>
        <div className={ui.actions}>
          <button
            type="button"
            className={ui.buttonGhost}
            onClick={() =>
              setNotice(
                "La impresión sale por el puente cuando esté conectado.",
              )
            }
          >
            Imprimir QR
          </button>
          <button
            type="button"
            className={ui.button}
            disabled={addPending}
            onClick={onAdd}
          >
            Agregar mesa
          </button>
        </div>
      </header>
      <ul className={ui.tabs}>
        {zones.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.id === zoneId ? ui.tabActive : ui.tab}
              onClick={() => onZone(item.id)}
            >
              {item.name}
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.layout}>
        <div className={styles.floor}>
          {tables.map((table) => (
            <TableButton
              key={table.id}
              table={table}
              active={table.id === selected?.id}
              onSelect={onSelect}
            />
          ))}
        </div>
        {selected ? (
          <TableCard
            table={selected}
            zoneName={zoneName}
            onRegenerate={() => onRegenerate(selected.id)}
            onDownload={() => downloadQr(selected)}
          />
        ) : (
          <p className={ui.empty}>Esta zona no tiene mesas.</p>
        )}
      </div>
      {notice.length > 0 ? (
        <p className={ui.note} role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

function TableButton({
  table,
  active,
  onSelect,
}: {
  table: DiningTable;
  active: boolean;
  onSelect: (tableId: string) => void;
}) {
  const wide = table.shape === "wide";
  const className = wide
    ? active
      ? styles.tableWideActive
      : styles.tableWide
    : active
      ? styles.tableActive
      : styles.table;

  return (
    <button
      type="button"
      className={className}
      aria-pressed={active}
      aria-label={`Mesa ${table.label}, ${table.seats} puestos`}
      onClick={() => onSelect(table.id)}
    >
      <span>
        <span className={styles.number}>{table.label}</span>
        <span className={styles.seats}>{table.seats} pax</span>
      </span>
    </button>
  );
}

function TableCard({
  table,
  zoneName,
  onRegenerate,
  onDownload,
}: {
  table: DiningTable;
  zoneName: string;
  onRegenerate: () => void;
  onDownload: () => void;
}) {
  return (
    <aside className={styles.panel}>
      <p className={styles.code}>Mesa {table.label}</p>
      <p className={styles.code}>{table.qrCode}</p>
      <QrMark code={`${table.qrCode}-${table.qrVersion}`} />
      <div className={styles.fact}>
        <span>Puestos</span>
        <strong>{table.seats}</strong>
      </div>
      <div className={styles.fact}>
        <span>Zona</span>
        <strong>{zoneName}</strong>
      </div>
      <div className={styles.fact}>
        <span>Versión del QR</span>
        <strong>V{table.qrVersion}</strong>
      </div>
      <div className={styles.panelActions}>
        <button type="button" className={ui.textButton} onClick={onRegenerate}>
          Regenerar
        </button>
        <button type="button" className={ui.textButton} onClick={onDownload}>
          Descargar
        </button>
      </div>
      <p className={ui.note}>Regenerar invalida el QR impreso anterior.</p>
    </aside>
  );
}

function QrMark({ code }: { code: string }) {
  const cells = qrCells(code);
  return (
    <div className={styles.qr} aria-hidden="true">
      {cells.map((filled, index) => (
        <span
          key={`${code}-${index}`}
          className={filled ? styles.cellOn : styles.cell}
        />
      ))}
    </div>
  );
}

function qrCells(code: string): boolean[] {
  const cells: boolean[] = [];
  let hash = 0;
  for (const char of code) {
    hash = (hash * 33 + char.charCodeAt(0)) % 997;
  }
  for (let index = 0; index < 121; index += 1) {
    const row = Math.floor(index / 11);
    const column = index % 11;
    const finder =
      (row < 3 && column < 3) ||
      (row < 3 && column > 7) ||
      (row > 7 && column < 3);
    cells.push(finder || (hash + index * 17) % 3 === 0);
  }
  return cells;
}

function downloadQr(table: DiningTable) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="280"><rect width="100%" height="100%" fill="#FBF8F1"/><text x="20" y="40" font-family="monospace" font-size="16">Mesa ${table.label}</text><text x="20" y="70" font-family="monospace" font-size="12">${table.qrCode}</text><text x="20" y="100" font-family="monospace" font-size="12">V${table.qrVersion}</text></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `mesa-${table.label}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}
