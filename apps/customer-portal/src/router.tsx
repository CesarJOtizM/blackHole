import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { HomeScreen } from "#src/home-screen.js";

const rootRoute = createRootRoute();

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeScreen,
});

const routeTree = rootRoute.addChildren([homeRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
