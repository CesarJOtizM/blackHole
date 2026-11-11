import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { CatalogScopeProvider } from "#src/catalog/catalog-scope.js";
import { ImportScreen } from "#src/catalog/import-screen.js";
import { IngredientsScreen } from "#src/catalog/ingredients-screen.js";
import { RecipesScreen } from "#src/catalog/recipes-screen.js";
import { HomeScreen } from "#src/home-screen.js";

const rootRoute = createRootRoute({
  component: AdminRoot,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeScreen,
});

const ingredientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ingredients",
  component: IngredientsScreen,
});

const recipesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recipes",
  component: RecipesScreen,
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: ImportScreen,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  ingredientsRoute,
  recipesRoute,
  importRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AdminRoot() {
  return (
    <CatalogScopeProvider>
      <Outlet />
    </CatalogScopeProvider>
  );
}
