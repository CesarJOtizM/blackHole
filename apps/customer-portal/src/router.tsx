import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { BillingDataScreen } from "#src/billing-data-screen.js";
import { HomeScreen } from "#src/home-screen.js";
import { InvoiceLinkScreen } from "#src/invoice-link-screen.js";
import { TableOrderScreen } from "#src/table-order/table-order-screen.js";
import { TablePaymentScreen } from "#src/table-payment/table-payment-screen.js";

const rootRoute = createRootRoute();

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeScreen,
});

const billingDataRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "d/$token",
  component: function BillingDataRoute() {
    const { token } = billingDataRoute.useParams();
    return (
      <>
        <TablePaymentScreen
          token={token}
          balanceCop={85_000}
          parts={[
            { partId: "part_1", balanceCop: 45_000, paid: true },
            { partId: "part_2", balanceCop: 40_000, paid: false },
          ]}
        />
        <BillingDataScreen token={token} />
      </>
    );
  },
});

const invoiceLinkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "f/$link",
  component: function InvoiceLinkRoute() {
    const { link } = invoiceLinkRoute.useParams();
    return <InvoiceLinkScreen link={link} status="in_process" />;
  },
});

const tableOrderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "m/$token",
  component: function TableOrderRoute() {
    const { token } = tableOrderRoute.useParams();
    return <TableOrderScreen token={token} />;
  },
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  billingDataRoute,
  invoiceLinkRoute,
  tableOrderRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
