import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const linkClass = "rounded-md px-3 py-2 text-ink-muted";
const activeClass = "rounded-md bg-ink px-3 py-2 text-on-strong";

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
    <main className="mx-auto min-h-svh max-w-5xl px-6 py-10">
      <nav className="flex flex-wrap gap-2 text-base">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className={linkClass}
          activeProps={{ className: activeClass }}
        >
          Inicio
        </Link>
        <Link
          to="/ingredients"
          className={linkClass}
          activeProps={{ className: activeClass }}
        >
          Ingredientes
        </Link>
        <Link
          to="/recipes"
          className={linkClass}
          activeProps={{ className: activeClass }}
        >
          Recetas
        </Link>
        <Link
          to="/import"
          className={linkClass}
          activeProps={{ className: activeClass }}
        >
          Importar
        </Link>
      </nav>
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-muted">{lede}</p>
      {children ? <div className="mt-8 grid gap-8">{children}</div> : null}
    </main>
  );
}
