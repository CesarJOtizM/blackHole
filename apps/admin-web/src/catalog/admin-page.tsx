import type { ReactNode } from "react";
import cloud from "#src/styles/catalog/cloud.module.scss";
import ui from "#src/styles/ui.module.scss";

export function AdminPage({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <div className={ui.page}>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>{lede}</p>
          <h1 className={ui.title}>{title}</h1>
        </div>
      </header>
      {children ? <div className={cloud.stack}>{children}</div> : null}
    </div>
  );
}
