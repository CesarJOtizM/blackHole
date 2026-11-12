import type { ReactNode } from "react";
import styles from "#src/styles/record.module.scss";
import ui from "#src/styles/ui.module.scss";

export type ChipTone = "go" | "stamp" | "hold" | "ink";

export type Cell = string | { chip: string; tone: ChipTone };

export interface RecordAction {
  label: string;
  tone: "solid" | "ghost";
  disabled?: boolean;
  onPress: () => void;
}

export interface RecordTab {
  id: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}

export interface RecordMetric {
  label: string;
  value: string;
  detail: string;
}

const chipClass: Record<ChipTone, string> = {
  go: ui.chipGo,
  stamp: ui.chipStamp,
  hold: ui.chipHold,
  ink: ui.chipInk,
};

export function RecordPage({
  eyebrow,
  title,
  actions = [],
  tabs = [],
  metrics = [],
  columns,
  rows = [],
  caption,
  empty,
  chart,
  note,
  status,
  aside,
  extraActions,
  children,
}: {
  eyebrow: string;
  title: string;
  actions?: RecordAction[];
  tabs?: RecordTab[];
  metrics?: RecordMetric[];
  columns?: string[];
  rows?: Cell[][];
  caption?: string;
  empty?: string;
  chart?: ReactNode;
  note?: string;
  status?: string;
  aside?: ReactNode;
  extraActions?: ReactNode;
  children?: ReactNode;
}) {
  const body = (
    <>
      {metrics.length > 0 ? (
        <div className={styles.metrics}>
          {metrics.map((metric) => (
            <article key={metric.label} className={styles.metric}>
              <p className={styles.metricLabel}>{metric.label}</p>
              <p className={styles.metricValue}>{metric.value}</p>
              <p className={styles.metricDetail}>{metric.detail}</p>
            </article>
          ))}
        </div>
      ) : null}
      {columns ? (
        <div className={chart ? styles.chartRow : undefined}>
          {chart}
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              {caption ? <caption className="srOnly">{caption}</caption> : null}
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${caption ?? "row"}-${index}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${index}-${cellIndex}`}>
                        {typeof cell === "string" ? (
                          cell
                        ) : (
                          <span className={chipClass[cell.tone]}>
                            {cell.chip}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && empty ? (
              <p className={ui.empty}>{empty}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
      {note ? <p className={ui.note}>{note}</p> : null}
      {status ? (
        <p className={ui.note} role="status">
          {status}
        </p>
      ) : null}
    </>
  );

  return (
    <div className={ui.page}>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>{eyebrow}</p>
          <h1 className={ui.title}>{title}</h1>
        </div>
        {extraActions || actions.length > 0 ? (
          <div className={ui.actions}>
            {extraActions}
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={action.tone === "solid" ? ui.button : ui.buttonGhost}
                disabled={action.disabled}
                onClick={action.onPress}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>
      {tabs.length > 0 ? (
        <ul className={ui.tabs}>
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                className={tab.active ? ui.tabActive : ui.tab}
                aria-current={tab.active ? "true" : undefined}
                onClick={tab.onSelect}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {aside ? (
        <div className={styles.split}>
          <div>{body}</div>
          <aside className={styles.card}>{aside}</aside>
        </div>
      ) : (
        body
      )}
    </div>
  );
}
