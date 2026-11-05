import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";

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

const routeTree = rootRoute.addChildren([
  floorRoute,
  kitchenRoute,
  registerRoute,
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
  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-surface-raised">
        <nav className="mx-auto flex max-w-3xl gap-2 px-4 py-3 text-base">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="rounded-md px-3 py-2 text-ink-muted"
            activeProps={{
              className: "rounded-md bg-ink px-3 py-2 text-on-strong",
            }}
          >
            Plano
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
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
