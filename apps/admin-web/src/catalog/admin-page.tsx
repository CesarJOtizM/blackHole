import type { ReactNode } from "react";
import cloud from "#src/styles/catalog/cloud.module.scss";
import ui from "#src/styles/ui.module.scss";

export function AdminPage({
  title,
  lede,
  action,
  children,
}: {
  title: string;
  lede: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={ui.page}>
      <header className={ui.pageHeader}>
        <div>
          <p className={ui.eyebrow}>{lede}</p>
          <h1 className={ui.title}>{title}</h1>
        </div>
        {action}
      </header>
      {children ? <div className={cloud.stack}>{children}</div> : null}
    </div>
  );
}
