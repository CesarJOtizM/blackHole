import { expect, it, vi } from "vitest";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  RealtimeHub,
  type RealtimeNotice,
} from "#application/ports/realtime-hub.js";
import { WithdrawUnstartedLines } from "#application/withdraw-unstarted-lines/withdraw-unstarted-lines.js";
import { Check } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const RIBS_ID = "menu_product_ribs";
const SALAD_ID = "menu_product_salad";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const EARLY_SENT_AT = "2026-10-28T12:03:10.000Z";
const MIDDLE_SENT_AT = "2026-10-28T12:10:00.000Z";
const SAME_SENT_AT = "2026-10-28T12:12:00.000Z";
const LATE_SENT_AT = "2026-10-28T12:20:00.000Z";
const STARTED_SENT_AT = "2026-10-28T12:25:00.000Z";
const PREPARED_AT = "2026-10-28T12:26:00.000Z";
const READY_AT = "2026-10-28T12:28:00.000Z";
const DELIVERED_AT = "2026-10-28T12:29:00.000Z";
const BEFORE_MIDNIGHT = new Date("2026-11-14T04:59:00.000Z");
const AFTER_MIDNIGHT = new Date("2026-11-14T05:01:00.000Z");

class MemoryDiningRoom extends DiningRoomRepository {
  private readonly checks: Check[] = [];

  seed(check: Check): void {
    this.checks.push(check);
  }

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
    return (
      this.checks.find(
        (check) =>
          check.tenantId === tenantId &&
          check.venueId === venueId &&
          check.id === checkId,
      ) ?? null
    );
  }

  override async saveCheck(check: Check): Promise<void> {
    const index = this.checks.findIndex(
      (stored) =>
        stored.tenantId === check.tenantId &&
        stored.venueId === check.venueId &&
        stored.id === check.id,
    );

    if (index === -1) {
      this.checks.push(check);
      return;
    }

    this.checks[index] = check;
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    for (const check of checks) {
      await this.saveCheck(check);
    }
  }

  override async listChecks(): Promise<readonly Check[]> {
    return [...this.checks];
  }
}

class MemoryHub extends RealtimeHub {
  readonly published: RealtimeNotice[] = [];

  override async publish(notice: RealtimeNotice): Promise<void> {
    this.published.push(notice);
  }
}

const openCheck = (
  checkId: string,
  tableId: string,
  tenantId = TENANT_ID,
  venueId = VENUE_ID,
): Check =>
  Check.open({
    id: checkId,
    tenantId,
    venueId,
    tableId,
    openedAt: OPENED_AT,
  });

const addLine = (
  check: Check,
  input: {
    orderId: string;
    lineId: string;
    productId: string;
    name: string;
    price: number;
  },
): void => {
  check.addLine({
    orderId: input.orderId,
    lineId: input.lineId,
    productId: input.productId,
    name: input.name,
    course: 1,
    price: input.price,
    channel: "waiter",
  });
};

const sendLine = (
  check: Check,
  input: {
    orderId: string;
    lineId: string;
    productId: string;
    name: string;
    price: number;
    sentAt: string;
  },
): void => {
  addLine(check, input);
  check.send({ course: 1, sentAt: input.sentAt });
};

const lineOf = (check: Check | null, lineId: string) =>
  check?.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId);

const command = (at: Date, uncoveredPortions: number) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  productId: RIBS_ID,
  uncoveredPortions,
  at,
});

const noticeFor = (
  checkId: string,
  tableId: string,
  lineIds: readonly string[],
  at: Date,
) => ({
  kind: "not_restocked" as const,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId,
  tableId,
  productId: RIBS_ID,
  lineIds: [...lineIds],
  at: at.toISOString(),
});

const harness = (checks: readonly Check[]) => {
  const dining = new MemoryDiningRoom();

  for (const check of checks) {
    dining.seed(check);
  }

  const hub = new MemoryHub();

  return {
    dining,
    hub,
    useCase: new WithdrawUnstartedLines(dining, hub),
  };
};

const startedCheck = (): Check => {
  const check = openCheck("check_4", "table_4");

  sendLine(check, {
    orderId: "order_early",
    lineId: "line_early",
    productId: RIBS_ID,
    name: "Ribs",
    price: 22_000,
    sentAt: EARLY_SENT_AT,
  });
  sendLine(check, {
    orderId: "order_middle",
    lineId: "line_middle",
    productId: RIBS_ID,
    name: "Ribs",
    price: 18_000,
    sentAt: MIDDLE_SENT_AT,
  });
  addLine(check, {
    orderId: "order_started",
    lineId: "line_prep",
    productId: RIBS_ID,
    name: "Ribs",
    price: 11_000,
  });
  addLine(check, {
    orderId: "order_started",
    lineId: "line_ready",
    productId: RIBS_ID,
    name: "Ribs",
    price: 12_000,
  });
  addLine(check, {
    orderId: "order_started",
    lineId: "line_delivered",
    productId: RIBS_ID,
    name: "Ribs",
    price: 13_000,
  });
  addLine(check, {
    orderId: "order_salad",
    lineId: "line_salad",
    productId: SALAD_ID,
    name: "Salad",
    price: 8_000,
  });
  check.send({ course: 1, sentAt: STARTED_SENT_AT });
  addLine(check, {
    orderId: "order_started",
    lineId: "line_held",
    productId: RIBS_ID,
    name: "Ribs",
    price: 9_000,
  });
  check.advance({
    lineId: "line_prep",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({
    lineId: "line_ready",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_ready", state: "ready", at: READY_AT });
  check.advance({
    lineId: "line_delivered",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_delivered", state: "ready", at: READY_AT });
  check.advance({
    lineId: "line_delivered",
    state: "delivered",
    at: DELIVERED_AT,
  });

  return check;
};

it("given an older sent rib and a later sent rib, when one uncovered portion is withdrawn, then only the older line is not delivered", async () => {
  const older = openCheck("check_4", "table_4");
  const later = openCheck("check_7", "table_7");
  const otherTenant = openCheck(
    "check_other",
    "table_9",
    OTHER_TENANT_ID,
    VENUE_ID,
  );
  const otherVenue = openCheck(
    "check_venue",
    "table_8",
    TENANT_ID,
    OTHER_VENUE_ID,
  );

  sendLine(otherTenant, {
    orderId: "order_other",
    lineId: "line_other",
    productId: RIBS_ID,
    name: "Ribs",
    price: 30_000,
    sentAt: "2026-10-28T12:01:00.000Z",
  });
  sendLine(otherVenue, {
    orderId: "order_venue",
    lineId: "line_venue",
    productId: RIBS_ID,
    name: "Ribs",
    price: 28_000,
    sentAt: "2026-10-28T12:02:00.000Z",
  });
  sendLine(later, {
    orderId: "order_late",
    lineId: "line_late",
    productId: RIBS_ID,
    name: "Ribs",
    price: 18_000,
    sentAt: LATE_SENT_AT,
  });
  sendLine(older, {
    orderId: "order_early",
    lineId: "line_early",
    productId: RIBS_ID,
    name: "Ribs",
    price: 22_000,
    sentAt: EARLY_SENT_AT,
  });

  const { dining, hub, useCase } = harness([
    otherTenant,
    otherVenue,
    later,
    older,
  ]);
  const saveCheck = vi.spyOn(dining, "saveCheck");

  const result = await useCase.execute(command(BEFORE_MIDNIGHT, 1));

  const storedOlder = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_4");
  const storedLater = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_7");

  expect(result).toEqual({
    today: "2026-11-13",
    withdrawn: [
      {
        checkId: "check_4",
        tableId: "table_4",
        lineIds: ["line_early"],
      },
    ],
  });
  expect(lineOf(storedOlder, "line_early")).toMatchObject({
    state: "not_delivered",
    sentAt: EARLY_SENT_AT,
    notDeliveredAt: BEFORE_MIDNIGHT.toISOString(),
    price: 22_000,
  });
  expect(lineOf(storedLater, "line_late")).toMatchObject({
    state: "sent",
    sentAt: LATE_SENT_AT,
    price: 18_000,
  });
  expect(lineOf(otherTenant, "line_other")?.state).toBe("sent");
  expect(lineOf(otherVenue, "line_venue")?.state).toBe("sent");
  expect(storedOlder?.total).toBe(0);
  expect(storedLater?.total).toBe(18_000);
  expect(hub.published).toEqual([
    noticeFor("check_4", "table_4", ["line_early"], BEFORE_MIDNIGHT),
  ]);
  expect(saveCheck.mock.calls.map((call) => call[0].id)).toEqual(["check_4"]);
  expect(Object.hasOwn(storedOlder ?? {}, "stockMovements")).toBe(false);
  expect(
    Object.hasOwn(lineOf(storedOlder, "line_early") ?? {}, "stockMovement"),
  ).toBe(false);
});

it("given sent, in preparation, ready, and delivered ribs, when uncovered sent lines are withdrawn, then started lines stay and each check gets one notice", async () => {
  const table4 = startedCheck();
  const table7 = openCheck("check_7", "table_7");

  sendLine(table7, {
    orderId: "order_late",
    lineId: "line_late",
    productId: RIBS_ID,
    name: "Ribs",
    price: 16_000,
    sentAt: LATE_SENT_AT,
  });

  const { dining, hub, useCase } = harness([table4, table7]);
  const saveCheck = vi.spyOn(dining, "saveCheck");

  const result = await useCase.execute(command(BEFORE_MIDNIGHT, 3));

  const stored4 = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_4");
  const stored7 = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_7");

  expect(result.today).toBe("2026-11-13");
  expect(result.withdrawn).toEqual([
    {
      checkId: "check_4",
      tableId: "table_4",
      lineIds: ["line_early", "line_middle"],
    },
    {
      checkId: "check_7",
      tableId: "table_7",
      lineIds: ["line_late"],
    },
  ]);
  expect(lineOf(stored4, "line_early")?.state).toBe("not_delivered");
  expect(lineOf(stored4, "line_middle")?.state).toBe("not_delivered");
  expect(lineOf(stored4, "line_prep")).toMatchObject({
    state: "in_preparation",
    inPreparationAt: PREPARED_AT,
  });
  expect(lineOf(stored4, "line_ready")).toMatchObject({
    state: "ready",
    readyAt: READY_AT,
  });
  expect(lineOf(stored4, "line_delivered")).toMatchObject({
    state: "delivered",
    deliveredAt: DELIVERED_AT,
  });
  expect(lineOf(stored4, "line_held")?.state).toBe("held");
  expect(lineOf(stored4, "line_salad")).toMatchObject({
    state: "sent",
    price: 8_000,
  });
  expect(lineOf(stored7, "line_late")?.state).toBe("not_delivered");
  expect(stored4?.total).toBe(44_000);
  expect(stored7?.total).toBe(0);
  expect(hub.published).toEqual([
    noticeFor(
      "check_4",
      "table_4",
      ["line_early", "line_middle"],
      BEFORE_MIDNIGHT,
    ),
    noticeFor("check_7", "table_7", ["line_late"], BEFORE_MIDNIGHT),
  ]);
  expect(saveCheck.mock.calls.map((call) => call[0].id)).toEqual([
    "check_4",
    "check_7",
  ]);
  expect(Object.hasOwn(stored4 ?? {}, "stockMovements")).toBe(false);
  expect(Object.hasOwn(stored7 ?? {}, "stockMovements")).toBe(false);
});

it("given two ribs sent at the same time, when one uncovered portion is withdrawn, then the earlier check is not delivered", async () => {
  const first = openCheck("check_4", "table_4");
  const second = openCheck("check_7", "table_7");

  sendLine(first, {
    orderId: "order_4",
    lineId: "line_4",
    productId: RIBS_ID,
    name: "Ribs",
    price: 10_000,
    sentAt: SAME_SENT_AT,
  });
  sendLine(second, {
    orderId: "order_7",
    lineId: "line_7",
    productId: RIBS_ID,
    name: "Ribs",
    price: 14_000,
    sentAt: SAME_SENT_AT,
  });

  const { dining, hub, useCase } = harness([first, second]);

  await useCase.execute(command(BEFORE_MIDNIGHT, 1.5));

  const storedFirst = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_4");
  const storedSecond = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_7");

  expect(lineOf(storedFirst, "line_4")?.state).toBe("not_delivered");
  expect(lineOf(storedSecond, "line_7")?.state).toBe("sent");
  expect(hub.published).toHaveLength(1);
  expect(hub.published[0]).toMatchObject({
    kind: "not_restocked",
    checkId: "check_4",
    lineIds: ["line_4"],
  });
});

it("given only ribs already in preparation, ready, or delivered, when the mark is confirmed, then no notice is sent", async () => {
  const check = openCheck("check_7", "table_7");

  sendLine(check, {
    orderId: "order_7",
    lineId: "line_prep",
    productId: RIBS_ID,
    name: "Ribs",
    price: 11_000,
    sentAt: LATE_SENT_AT,
  });
  sendLine(check, {
    orderId: "order_ready",
    lineId: "line_ready",
    productId: RIBS_ID,
    name: "Ribs",
    price: 12_000,
    sentAt: LATE_SENT_AT,
  });
  sendLine(check, {
    orderId: "order_delivered",
    lineId: "line_delivered",
    productId: RIBS_ID,
    name: "Ribs",
    price: 13_000,
    sentAt: LATE_SENT_AT,
  });
  check.advance({
    lineId: "line_prep",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({
    lineId: "line_ready",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_ready", state: "ready", at: READY_AT });
  check.advance({
    lineId: "line_delivered",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: "line_delivered", state: "ready", at: READY_AT });
  check.advance({
    lineId: "line_delivered",
    state: "delivered",
    at: DELIVERED_AT,
  });

  const { dining, hub, useCase } = harness([check]);
  const saveCheck = vi.spyOn(dining, "saveCheck");

  const result = await useCase.execute(command(BEFORE_MIDNIGHT, 4));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_7");

  expect(result).toEqual({ today: "2026-11-13", withdrawn: [] });
  expect(lineOf(stored, "line_prep")?.state).toBe("in_preparation");
  expect(lineOf(stored, "line_ready")?.state).toBe("ready");
  expect(lineOf(stored, "line_delivered")?.state).toBe("delivered");
  expect(stored?.total).toBe(36_000);
  expect(hub.published).toEqual([]);
  expect(saveCheck).not.toHaveBeenCalled();
});

it("given a sent rib and no uncovered portion after midnight, when withdrawal runs, then the line stays and today is the Bogota date", async () => {
  const check = openCheck("check_4", "table_4");

  sendLine(check, {
    orderId: "order_4",
    lineId: "line_early",
    productId: RIBS_ID,
    name: "Ribs",
    price: 22_000,
    sentAt: EARLY_SENT_AT,
  });

  const { dining, hub, useCase } = harness([check]);
  const listChecks = vi.spyOn(dining, "listChecks");
  const saveCheck = vi.spyOn(dining, "saveCheck");

  const result = await useCase.execute(command(AFTER_MIDNIGHT, 0));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_4");

  expect(result).toEqual({ today: "2026-11-14", withdrawn: [] });
  expect(lineOf(stored, "line_early")?.state).toBe("sent");
  expect(stored?.total).toBe(22_000);
  expect(hub.published).toEqual([]);
  expect(listChecks).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
});

it("given a sent rib after midnight, when one uncovered portion is withdrawn, then the line is not delivered on the new Bogota date", async () => {
  const check = openCheck("check_4", "table_4");

  sendLine(check, {
    orderId: "order_4",
    lineId: "line_early",
    productId: RIBS_ID,
    name: "Ribs",
    price: 22_000,
    sentAt: EARLY_SENT_AT,
  });

  const { dining, hub, useCase } = harness([check]);
  const saveCheck = vi.spyOn(dining, "saveCheck");

  const result = await useCase.execute(command(AFTER_MIDNIGHT, 1));

  expect(saveCheck).toHaveBeenCalledTimes(1);
  expect(hub.published).toEqual([
    noticeFor("check_4", "table_4", ["line_early"], AFTER_MIDNIGHT),
  ]);
  saveCheck.mockClear();
  hub.published.length = 0;

  const again = await useCase.execute(command(AFTER_MIDNIGHT, 1));
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, "check_4");

  expect(result.today).toBe("2026-11-14");
  expect(result.withdrawn).toEqual([
    {
      checkId: "check_4",
      tableId: "table_4",
      lineIds: ["line_early"],
    },
  ]);
  expect(again).toEqual({ today: "2026-11-14", withdrawn: [] });
  expect(lineOf(stored, "line_early")).toMatchObject({
    state: "not_delivered",
    notDeliveredAt: AFTER_MIDNIGHT.toISOString(),
  });
  expect(hub.published).toEqual([]);
  expect(saveCheck).not.toHaveBeenCalled();
  expect(Object.hasOwn(stored ?? {}, "stockMovements")).toBe(false);
});
