import type { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import {
  routePermissions,
  ShortageAlertsController,
} from "#src/http/shortage-alerts.controller.js";
import {
  chiefSession,
  closeShortageDatabases,
  levelsUrl,
  listening,
  openShortageCloud,
  postJson,
  restockBody,
  restockUrl,
  seenUrl,
  waiterSession,
} from "#test/http/shortage-alerts-cloud.js";

afterAll(closeShortageDatabases);

it("given shortage alerts are off, when restock, stock levels, and seen are posted, then the routes are skipped and nothing is listening", async () => {
  const { application } = await openShortageCloud(false);

  try {
    const restock = await postJson(
      application,
      restockUrl,
      chiefSession,
      restockBody("purchase_off"),
    );
    const levels = await postJson(application, levelsUrl, chiefSession, {
      ingredientId: "ingredient_beef",
      maximum: 20,
      reorderPoint: 8,
      minimum: 4,
    });
    const seen = await postJson(application, seenUrl, chiefSession, {});

    expect(listening(application)).toBe(false);
    expect(restock.statusCode).toBe(404);
    expect(levels.statusCode).toBe(404);
    expect(seen.statusCode).toBe(404);
    expect(() => application.get(ShortageAlertsController)).toThrow();
  } finally {
    await application.close();
  }
});

it("given a waiter, when restock is posted, then inventory.request-replenishment denies it", async () => {
  const { application, inventoryDatabase } = await openShortageCloud(true);
  const client = inventoryDatabase as PGlite;

  try {
    expect(routePermissions["POST shortage-alerts/:alertId/restock"]).toBe(
      "inventory.request-replenishment",
    );
    expect(application.get(ShortageAlertsController)).toBeInstanceOf(
      ShortageAlertsController,
    );

    const response = await postJson(
      application,
      restockUrl,
      waiterSession,
      restockBody("purchase_waiter"),
    );
    const documents = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM shortage_alerts WHERE document_id IS NOT NULL",
    );

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "RestockDenied" });
    expect(documents.rows[0]?.count).toBe("0");
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});

it("given a kitchen chief and no open alert, when restock is posted, then the permission allows the tap and the alert is missing", async () => {
  const { application } = await openShortageCloud(true);

  try {
    const response = await postJson(
      application,
      restockUrl,
      chiefSession,
      restockBody("purchase_chief"),
    );

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "ShortageAlertNotFound" });
    expect(listening(application)).toBe(false);
  } finally {
    await application.close();
  }
});
