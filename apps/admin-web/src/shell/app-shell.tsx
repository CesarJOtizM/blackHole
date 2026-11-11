import { Outlet, useRouterState } from "@tanstack/react-router";
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
        <Outlet />
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
