import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  lazyRouteComponent,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { ServiceProvider } from "#src/service/service-session.js";

const rootRoute = createRootRoute({
  component: VenueLayout,
});

const floorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(
    () => import("#src/orders/floor-screen.js"),
    "FloorScreen",
  ),
});

const kitchenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "kitchen",
  component: lazyRouteComponent(
    () => import("#src/kitchen/kitchen-screen.js"),
    "KitchenScreen",
  ),
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "cash-register",
  component: lazyRouteComponent(
    () => import("#src/cash-register/register-screen.js"),
    "RegisterScreen",
  ),
});

const clockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "attendance",
  component: lazyRouteComponent(
    () => import("#src/attendance/clock-screen.js"),
    "ClockScreen",
  ),
});

const purchasingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "purchasing",
  component: lazyRouteComponent(
    () => import("#src/purchasing/receive-screen.js"),
    "ReceiveScreen",
  ),
});

const transfersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "transfers",
  component: lazyRouteComponent(
    () => import("#src/transfers/transfer-screen.js"),
    "TransferScreen",
  ),
});

const stockCountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "stock-count",
  component: lazyRouteComponent(
    () => import("#src/stock-counts/count-screen.js"),
    "StockCountScreen",
  ),
});

const routeTree = rootRoute.addChildren([
  floorRoute,
  kitchenRoute,
  registerRoute,
  clockRoute,
  purchasingRoute,
  transfersRoute,
  stockCountRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: PendingScreen,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function PendingScreen() {
  return <p className="text-ink-muted">Cargando</p>;
}

function VenueLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const wide = pathname.startsWith("/kitchen");

  return (
    <ServiceProvider>
      <div className="min-h-svh">
        <header className="border-b border-border bg-surface-raised">
          <nav className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3 text-base">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              className="rounded-md px-3 py-2 text-ink-muted"
              activeProps={{
                className: "rounded-md bg-ink px-3 py-2 text-on-strong",
              }}
            >
              Salón
            </Link>
            <Link
              to="/kitchen"
              className="rounded-md px-3 py-2 text-ink-muted"
              activeProps={{
                className: "rounded-md bg-ink px-3 py-2 text-on-strong",
              }}
            >
              Cocina
            </Link>
            <Link
              to="/cash-register"
              className="rounded-md px-3 py-2 text-ink-muted"
              activeProps={{
                className: "rounded-md bg-ink px-3 py-2 text-on-strong",
              }}
            >
              Caja
            </Link>
            <Link
              to="/attendance"
              className="rounded-md px-3 py-2 text-ink-muted"
              activeProps={{
                className: "rounded-md bg-ink px-3 py-2 text-on-strong",
              }}
            >
              Asistencia
            </Link>
            <Link
              to="/purchasing"
              className="rounded-md px-3 py-2 text-ink-muted"
              activeProps={{
                className: "rounded-md bg-ink px-3 py-2 text-on-strong",
              }}
            >
              Recepción
            </Link>
            <Link
              to="/transfers"
              className="rounded-md px-3 py-2 text-ink-muted"
              activeProps={{
                className: "rounded-md bg-ink px-3 py-2 text-on-strong",
              }}
            >
              Traslados
            </Link>
            <Link
              to="/stock-count"
              className="rounded-md px-3 py-2 text-ink-muted"
              activeProps={{
                className: "rounded-md bg-ink px-3 py-2 text-on-strong",
              }}
            >
              Conteo
            </Link>
          </nav>
        </header>
        <main className={wide ? "px-4 py-6" : "mx-auto max-w-3xl px-4 py-8"}>
          <Outlet />
        </main>
      </div>
    </ServiceProvider>
  );
}
