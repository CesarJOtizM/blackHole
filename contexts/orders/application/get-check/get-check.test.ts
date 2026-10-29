import { expect, it, vi } from "vitest";

import { GetCheck } from "#application/get-check/get-check.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { Check } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const ORDER_ID = "order_1";
const SOUP_ID = "menu_product_soup";
const STEAK_ID = "menu_product_steak";
const OPENED_AT = "2026-10-28T11:50:00.000Z";
const AT_1200 = "2026-10-28T12:00:00.000Z";

class MemoryDiningRoom extends DiningRoomRepository {
  private readonly checks = new Map<string, Check>();

  override async load(
    _tenantId: string,
    _venueId: string,
    _tableId: string,
  ): Promise<DiningTable | null> {
    return null;
  }

  override async save(_table: DiningTable): Promise<void> {}

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    return this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null;
  }

  override async saveCheck(check: Check): Promise<void> {
    this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    for (const check of checks) {
      await this.saveCheck(check);
    }
  }
}

const openCheck = (tenantId: string): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_soup",
    productId: SOUP_ID,
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });

  return check;
};

it("given a check, when it is read, then ids and the account return", async () => {
  const dining = new MemoryDiningRoom();
  const getCheck = new GetCheck(dining);
  const check = openCheck(TENANT_ID);
  check.send({ course: 1, sentAt: AT_1200 });
  await dining.saveCheck(check);
  const save = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");

  const account = await getCheck.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
  });

  expect(save).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
  expect(saveChecks).not.toHaveBeenCalled();
  expect(account).toEqual({
    checkId: CHECK_ID,
    tableId: TABLE_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    lineIds: ["line_soup"],
    total: 12_000,
    orders: [
      {
        id: ORDER_ID,
        channel: "waiter",
        lines: [
          {
            id: "line_soup",
            productId: SOUP_ID,
            name: "Soup",
            course: 1,
            price: 12_000,
            state: "sent",
            sentAt: AT_1200,
            originTableId: TABLE_ID,
          },
        ],
      },
    ],
  });
});

it("given held lines, when the check is read, then they are off the total", async () => {
  const dining = new MemoryDiningRoom();
  const getCheck = new GetCheck(dining);
  const check = openCheck(TENANT_ID);
  check.addLine({
    orderId: ORDER_ID,
    lineId: "line_steak",
    productId: STEAK_ID,
    name: "Steak",
    course: 2,
    price: 45_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: AT_1200 });
  await dining.saveCheck(check);

  const account = await getCheck.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
  });

  expect(account?.total).toBe(12_000);
  expect(account?.orders[0]?.lines.map((line) => line.state)).toEqual([
    "sent",
    "held",
  ]);
});

it("given another tenant, when the check is read, then that tenant stays hidden", async () => {
  const dining = new MemoryDiningRoom();
  const getCheck = new GetCheck(dining);
  const theirs = openCheck(OTHER_TENANT_ID);
  theirs.send({ course: 1, sentAt: AT_1200 });
  await dining.saveCheck(theirs);
  const loadCheck = vi.spyOn(dining, "loadCheck");
  const saveCheck = vi.spyOn(dining, "saveCheck");

  const account = await getCheck.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
  });

  expect(loadCheck).toHaveBeenCalledWith(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(saveCheck).not.toHaveBeenCalled();
  expect(account).toBeNull();
  expect(
    (await dining.loadCheck(OTHER_TENANT_ID, VENUE_ID, CHECK_ID))?.total,
  ).toBe(12_000);
});
