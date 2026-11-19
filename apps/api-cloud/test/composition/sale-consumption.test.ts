import { shortageNotice } from "@blackhole/contracts";
import type { NegativeStockOpenedEvent } from "@blackhole/inventory/application/ports/stock-alert-publisher";
import { expect, it } from "vitest";

import {
  NegativeStockNoticeLog,
  StoredStockAlertPublisher,
} from "#src/composition/sale-consumption.js";

const opened: NegativeStockOpenedEvent = {
  type: "NegativeStockOpened",
  tenantId: "tenant-1",
  venueId: "chapinero",
  locationId: "point-1",
  ingredientId: "beef",
  balance: -200,
  occurredAt: "2026-11-19T17:00:00.000Z",
};

it("given a negative-stock open event, when publish runs, then one notice is recorded for that ingredient and a second publish of the same open alert does not duplicate it", async () => {
  const notices = new NegativeStockNoticeLog();
  const publisher = new StoredStockAlertPublisher(notices);

  await publisher.publish(opened);
  await publisher.publish({ ...opened, balance: -400 });

  expect(notices.notices).toEqual([
    {
      alertId: "negative-stock:point-1:beef",
      kind: "level",
      severity: "critical",
      role: "siteAdministrator",
      venueId: "chapinero",
      tenantId: "tenant-1",
      locationId: "point-1",
      ingredientId: "beef",
    },
  ]);
  expect(
    shortageNotice.safeParse(
      notices.screenNotices(opened.tenantId, opened.venueId)[0],
    ).success,
  ).toBe(true);
});
