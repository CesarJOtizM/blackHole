import { expect, it } from "vitest";

import { ApplicationModule } from "#src/composition/application-module.js";
import { createApplication } from "#src/composition/create-application.js";
import { PrintingController } from "#src/http/printing.controller.js";
import {
  routePermissions,
  SensitiveActionsController,
} from "#src/http/sensitive-actions.controller.js";

const tenantId = "organization_tenant_1";
const venueId = "organization_venue_1";
const prefix = `/tenants/${tenantId}/venues/${venueId}`;
const drawerPayload = {
  kickDrawer: true,
  authorizerId: "identity_supervisor",
};

const sensitiveRoutes = [
  ["POST", `${prefix}/checks/check_1/lines/line_1/void`],
  ["POST", `${prefix}/checks/check_1/void`],
  ["POST", `${prefix}/checks/check_1/discount`],
  ["POST", `${prefix}/checks/check_1/courtesy`],
  ["POST", `${prefix}/checks/check_1/lines/line_1/price`],
  ["POST", `${prefix}/checks/check_1/transfer-table`],
  ["POST", `${prefix}/cash-registers/register_1/open-drawer`],
  ["POST", `${prefix}/cash-registers/register_1/payments/payment_1/reopen`],
  ["POST", `${prefix}/cash-registers/register_1/payments/payment_1/tender`],
  ["GET", `${prefix}/control-report`],
  ["GET", `${prefix}/unusual-behavior`],
  ["PUT", `${prefix}/tip-rule`],
  ["POST", `${prefix}/tip-settlements`],
  ["POST", `${prefix}/tip-settlements/settlement_1/adjustments`],
  ["POST", `${prefix}/tip-settlements/settlement_1/print`],
] as const;

it("given each sensitive route, when the node is called, then the response is 403 SensitiveActionRejected and nothing is stored", async () => {
  expect(routePermissions).toEqual({
    "POST checks/:checkId/lines/:lineId/void": "sale.void-before-kitchen",
    "POST checks/:checkId/void": "sale.void-account",
    "POST checks/:checkId/discount": "sale.discount",
    "POST checks/:checkId/courtesy": "sale.comp",
    "POST checks/:checkId/lines/:lineId/price": "sale.change-price",
    "POST checks/:checkId/transfer-table": "sale.transfer-table",
    "POST cash-registers/:registerId/open-drawer": "cash.open-drawer",
    "POST cash-registers/:registerId/payments/:paymentId/reopen":
      "sale.reopen-paid",
    "POST cash-registers/:registerId/payments/:paymentId/tender":
      "sale.change-tender",
    "GET control-report": "audit.view",
    "GET unusual-behavior": "audit.view",
    "PUT tip-rule": "cash.settle-tips",
    "POST tip-settlements": "cash.settle-tips",
    "POST tip-settlements/:id/adjustments": "cash.settle-tips",
    "POST tip-settlements/:id/print": "cash.settle-tips",
  });
  expect(PrintingController.length).toBe(0);
  expect(SensitiveActionsController.length).toBe(0);
  const application = await createApplication();

  try {
    const routesBefore = application
      .getHttpAdapter()
      .getInstance()
      .printRoutes();

    for (const [method, url] of sensitiveRoutes) {
      const response = await application.inject({
        method,
        url,
        payload: method === "GET" ? undefined : drawerPayload,
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: "SensitiveActionRejected" });
    }

    expect(application.getHttpAdapter().getInstance().printRoutes()).toBe(
      routesBefore,
    );
    const providers = Reflect.getMetadata("providers", ApplicationModule) ?? [];

    expect(providers).toEqual([]);
    expect(JSON.stringify(providers)).not.toMatch(
      /TipRule|TipSettlement|PrintJob|ConfigureTipRule|SettleTips|AdjustTipSettlement|PrintTipSettlement/,
    );
    expect(Reflect.getMetadata("imports", ApplicationModule) ?? []).toEqual([]);
  } finally {
    await application.close();
  }
});
