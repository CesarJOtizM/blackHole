import type { ReportChart } from "#src/reports/reports-model.js";
import styles from "#src/styles/record.module.scss";

export function BarChart({ chart }: { chart: ReportChart }) {
  const tallest = Math.max(...chart.bars.map((bar) => bar.height));

  return (
    <figure className={styles.chart}>
      <figcaption className={styles.chartTitle}>{chart.title}</figcaption>
      <div className={styles.bars}>
        {chart.bars.map((bar) => (
          <div key={bar.label} className={styles.column}>
            <div className={styles.plot}>
              <div
                className={
                  bar.tone === "stamp" ? styles.barStamp : styles.barInk
                }
                style={{ height: `${(bar.height / tallest) * 100}%` }}
              />
            </div>
            <span className={styles.barLabel}>{bar.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
