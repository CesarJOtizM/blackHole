import { Outlet, useRouterState } from "@tanstack/react-router";
import { CatalogScopeProvider } from "#src/catalog/catalog-scope.js";
import { Sidebar } from "#src/shell/sidebar.js";
import styles from "#src/styles/shell.module.scss";

export function AppShell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <div className={styles.frame}>
      <Sidebar pathname={pathname} />
      <div className={styles.main}>
        <CatalogScopeProvider>
          <Outlet />
        </CatalogScopeProvider>
      </div>
    </div>
  );
}

export function RootFrame() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const publicAccess = pathname === "/login" || pathname.startsWith("/login/");

  if (publicAccess) {
    return <Outlet />;
  }

  return <AppShell />;
}
