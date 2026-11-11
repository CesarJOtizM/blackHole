import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import { isSignedIn, signedInEmail } from "#src/access/session.js";
import { ImportScreen } from "#src/catalog/import-screen.js";
import { IngredientsScreen } from "#src/catalog/ingredients-screen.js";
import { RecipesScreen } from "#src/catalog/recipes-screen.js";
import { RootFrame } from "#src/shell/app-shell.js";

const rootRoute = createRootRoute({
  beforeLoad: ({ location }) => {
    const path = location.pathname;
    if (path === "/" || path === "/login") {
      return;
    }
    if (path === "/login/factor") {
      if (signedInEmail().length === 0) {
        throw redirect({ to: "/login" });
      }
      return;
    }
    if (!isSignedIn()) {
      throw redirect({ to: "/login" });
    }
  },
  component: RootFrame,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: isSignedIn() ? "/home" : "/login" });
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "login",
  component: lazyRouteComponent(
    () => import("#src/access/login-screen.js"),
    "LoginScreen",
  ),
});

const factorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "login/factor",
  component: lazyRouteComponent(
    () => import("#src/access/factor-screen.js"),
    "FactorScreen",
  ),
});

type VenueSearch = {
  venue: "chapinero" | "usaquen";
};

function venueSearch(search: Record<string, unknown>): VenueSearch {
  if (search.venue === "usaquen") {
    return { venue: "usaquen" };
  }
  return { venue: "chapinero" };
}

function page<const TPath extends string>(
  path: TPath,
  load: () => Promise<Record<string, unknown>>,
  name: string,
) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: lazyRouteComponent(load, name),
  });
}

const menuRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "catalog/menu",
  component: lazyRouteComponent(
    () => import("#src/catalog/menu/menu-screen.js"),
    "MenuScreen",
  ),
});

const productRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "catalog/menu/$productId",
  component: lazyRouteComponent(
    () => import("#src/catalog/product/product-screen.js"),
    "ProductScreen",
  ),
});

const venueMenuRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "catalog/venues/$venueId",
  component: lazyRouteComponent(
    () => import("#src/catalog/venue-menu/venue-menu-screen.js"),
    "VenueMenuScreen",
  ),
});

const tablesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "catalog/tables",
  validateSearch: venueSearch,
  component: lazyRouteComponent(
    () => import("#src/catalog/tables/tables-screen.js"),
    "TablesScreen",
  ),
});

const qrOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "catalog/qr-orders",
  validateSearch: venueSearch,
  component: lazyRouteComponent(
    () => import("#src/catalog/qr-orders/qr-orders-screen.js"),
    "QrOrdersScreen",
  ),
});

const reportsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "reports",
  beforeLoad: () => {
    throw redirect({ to: "/reports/sales" });
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  factorRoute,
  menuRoute,
  productRoute,
  venueMenuRoute,
  tablesRoute,
  qrOrdersRoute,
  page("home", () => import("#src/home/home-screen.js"), "HomeScreen"),
  reportsIndexRoute,
  page(
    "reports/sales",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page(
    "reports/times",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page(
    "reports/food-cost",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page(
    "reports/leakage",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page(
    "reports/staff",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page(
    "reports/accountant",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page(
    "reports/engineering",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page(
    "reports/reservations",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page(
    "reports/control",
    () => import("#src/reports/reports-screen.js"),
    "ReportsScreen",
  ),
  page("audit", () => import("#src/audit/audit-screen.js"), "AuditScreen"),
  page(
    "inventory",
    () => import("#src/inventory/inventory-screen.js"),
    "SuppliesScreen",
  ),
  page(
    "inventory/recipes/churrasco",
    () => import("#src/inventory/inventory-screen.js"),
    "RecipeScreen",
  ),
  page(
    "inventory/orders/oc-0418",
    () => import("#src/inventory/inventory-screen.js"),
    "PurchaseScreen",
  ),
  page(
    "inventory/consolidated",
    () => import("#src/inventory/inventory-screen.js"),
    "ConsolidatedScreen",
  ),
  page(
    "inventory/transfers",
    () => import("#src/inventory/inventory-screen.js"),
    "TransfersScreen",
  ),
  page(
    "inventory/transfers/t-0112",
    () => import("#src/inventory/inventory-screen.js"),
    "TransferDetailScreen",
  ),
  page(
    "inventory/scarcity",
    () => import("#src/scarcity/scarcity-screen.js"),
    "ScarcityScreen",
  ),
  page(
    "inventory/scarcity/warehouse",
    () => import("#src/scarcity/scarcity-screen.js"),
    "WarehouseRequestScreen",
  ),
  page(
    "inventory/scarcity/purchase",
    () => import("#src/scarcity/scarcity-screen.js"),
    "PurchaseRequestScreen",
  ),
  page(
    "deliveries",
    () => import("#src/channels/channels-screen.js"),
    "ChannelsScreen",
  ),
  page(
    "deliveries/mapping",
    () => import("#src/channels/channels-screen.js"),
    "MappingScreen",
  ),
  page(
    "deliveries/reconciliation",
    () => import("#src/channels/channels-screen.js"),
    "ReconciliationScreen",
  ),
  page(
    "reservations",
    () => import("#src/reservations/reservations-screen.js"),
    "SlotsScreen",
  ),
  page(
    "reservations/accounts",
    () => import("#src/reservations/reservations-screen.js"),
    "AccountsScreen",
  ),
  page(
    "reservations/cancellation",
    () => import("#src/reservations/reservations-screen.js"),
    "CancellationScreen",
  ),
  page(
    "structure",
    () => import("#src/structure/structure-screen.js"),
    "CompanyScreen",
  ),
  page(
    "structure/chapinero",
    () => import("#src/structure/structure-screen.js"),
    "VenueScreen",
  ),
  page(
    "structure/devices",
    () => import("#src/structure/structure-screen.js"),
    "DevicesScreen",
  ),
  page(
    "structure/hybrid",
    () => import("#src/structure/structure-screen.js"),
    "HybridScreen",
  ),
  page(
    "structure/return",
    () => import("#src/structure/structure-screen.js"),
    "ReturnScreen",
  ),
  page(
    "fiscal",
    () => import("#src/fiscal/fiscal-screen.js"),
    "TaxProfileScreen",
  ),
  page(
    "fiscal/documents",
    () => import("#src/fiscal/fiscal-screen.js"),
    "DocumentsScreen",
  ),
  page(
    "fiscal/balance",
    () => import("#src/fiscal/fiscal-screen.js"),
    "BalanceScreen",
  ),
  page("people", () => import("#src/people/people-screen.js"), "PeopleScreen"),
  page(
    "people/roles/cajero-senior",
    () => import("#src/people/people-screen.js"),
    "RoleScreen",
  ),
  page(
    "attendance",
    () => import("#src/attendance/attendance-screen.js"),
    "ScheduleScreen",
  ),
  page(
    "attendance/rules",
    () => import("#src/attendance/attendance-screen.js"),
    "RulesScreen",
  ),
  page(
    "attendance/hours",
    () => import("#src/attendance/attendance-screen.js"),
    "HoursScreen",
  ),
  page("plan", () => import("#src/platform/platform-screen.js"), "PlanScreen"),
  page(
    "plan/setup",
    () => import("#src/platform/platform-screen.js"),
    "SetupScreen",
  ),
  page(
    "plan/support",
    () => import("#src/platform/platform-screen.js"),
    "SupportScreen",
  ),
  page(
    "plan/bag",
    () => import("#src/platform/platform-screen.js"),
    "BagScreen",
  ),
  page(
    "plan/bag/empty",
    () => import("#src/platform/platform-screen.js"),
    "EmptyBagScreen",
  ),
  page(
    "plan/suspended",
    () => import("#src/platform/platform-screen.js"),
    "SuspendedScreen",
  ),
  page(
    "plan/factus",
    () => import("#src/factus/factus-screen.js"),
    "FactusDocumentsScreen",
  ),
  page(
    "plan/factus/contributors",
    () => import("#src/factus/factus-screen.js"),
    "ContributorsScreen",
  ),
  page(
    "support/companies",
    () => import("#src/platform/platform-screen.js"),
    "CompaniesScreen",
  ),
  page(
    "support/cases/4821",
    () => import("#src/platform/platform-screen.js"),
    "CaseScreen",
  ),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "ingredients",
    component: IngredientsScreen,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "recipes",
    component: RecipesScreen,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "import",
    component: ImportScreen,
  }),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
