import {
  ConfirmGuestTold as GuestToldOnEntryPort,
  MarkLineUndeliverable as MarkOnEntryPort,
  WithdrawUnstartedLines as WithdrawOnEntryPort,
} from "@blackhole/orders/application/entry-port";
import { expect, it } from "vitest";
import { ConfirmGuestTold } from "#application/confirm-guest-told/confirm-guest-told.js";
import { MarkLineUndeliverable } from "#application/mark-line-undeliverable/mark-line-undeliverable.js";
import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  RealtimeHub,
  type RealtimeNotice,
} from "#application/ports/realtime-hub.js";
import { WithdrawUnstartedLines } from "#application/withdraw-unstarted-lines/withdraw-unstarted-lines.js";
import { Check, UndeliverableLineRejected } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "check_7";
const TABLE_ID = "table_7";
const RIBS_ID = "menu_product_ribs";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:10:00.000Z";
const PREPARED_AT = "2026-10-28T12:20:00.000Z";
const READY_AT = "2026-10-28T12:30:00.000Z";
const DELIVERED_AT = "2026-10-28T12:40:00.000Z";
const MARKED_AT = Date.parse("2026-10-28T12:45:00.000Z");

class FixedClock extends Clock {
  override now(): number {
    return MARKED_AT;
  }
}

class MemoryDiningRoom extends DiningRoomRepository {
  readonly saved: Check[] = [];

  constructor(private readonly check: Check) {
    super();
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
    if (
      this.check.tenantId === tenantId &&
      this.check.venueId === venueId &&
      this.check.id === checkId
    ) {
      return this.check;
    }

    return null;
  }

  override async saveCheck(check: Check): Promise<void> {
    this.saved.push(check);
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    for (const check of checks) {
      await this.saveCheck(check);
    }
  }
}

class MemoryHub extends RealtimeHub {
  readonly published: RealtimeNotice[] = [];

  override async publish(notice: RealtimeNotice): Promise<void> {
    this.published.push(notice);
  }
}

const startedCheck = (): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: "order_ribs",
    lineId: "line_prep",
    productId: RIBS_ID,
    name: "Ribs",
    course: 1,
    price: 22_000,
    channel: "waiter",
  });
  check.addLine({
    orderId: "order_ribs",
    lineId: "line_ready",
    productId: RIBS_ID,
    name: "Ribs",
    course: 1,
    price: 22_000,
    channel: "waiter",
  });
  check.addLine({
    orderId: "order_ribs",
    lineId: "line_delivered",
    productId: RIBS_ID,
    name: "Ribs",
    course: 1,
    price: 22_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: SENT_AT });
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
  check.advance({
    lineId: "line_ready",
    state: "ready",
    at: READY_AT,
  });
  check.advance({
    lineId: "line_delivered",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({
    lineId: "line_delivered",
    state: "ready",
    at: READY_AT,
  });
  check.advance({
    lineId: "line_delivered",
    state: "delivered",
    at: DELIVERED_AT,
  });

  return check;
};

const lineOf = (check: Check, lineId: string) =>
  check.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId);

it("given the orders entry port, when the withdrawal use cases are resolved, then it exposes withdraw, guest told, and mark undeliverable", () => {
  expect(WithdrawOnEntryPort).toBe(WithdrawUnstartedLines);
  expect(GuestToldOnEntryPort).toBe(ConfirmGuestTold);
  expect(MarkOnEntryPort).toBe(MarkLineUndeliverable);
});

const harness = () => {
  const dining = new MemoryDiningRoom(startedCheck());
  const hub = new MemoryHub();
  const useCase = new MarkLineUndeliverable(dining, new FixedClock(), hub);

  return { dining, hub, useCase };
};

it("given ribs in preparation or ready, when the station cannot finish them, then those lines become not delivered", async () => {
  const { dining, hub, useCase } = harness();

  await useCase.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    lineId: "line_prep",
  });
  await useCase.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    lineId: "line_ready",
  });

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);

  if (stored === null) {
    throw new Error("Expected the check.");
  }

  const markedAt = new Date(MARKED_AT).toISOString();

  expect(lineOf(stored, "line_prep")).toEqual(
    expect.objectContaining({
      state: "not_delivered",
      notDeliveredAt: markedAt,
    }),
  );
  expect(lineOf(stored, "line_ready")).toEqual(
    expect.objectContaining({
      state: "not_delivered",
      notDeliveredAt: markedAt,
    }),
  );
  expect(dining.saved).toHaveLength(2);
  expect(hub.published).toEqual([
    {
      kind: "not_restocked",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      productId: RIBS_ID,
      lineIds: ["line_prep"],
      at: markedAt,
    },
    {
      kind: "not_restocked",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      productId: RIBS_ID,
      lineIds: ["line_ready"],
      at: markedAt,
    },
  ]);
});

it("given ribs already delivered, when the station marks that line, then it is rejected and no notice is sent", async () => {
  const { dining, hub, useCase } = harness();

  await expect(
    useCase.execute({
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      lineId: "line_delivered",
    }),
  ).rejects.toBeInstanceOf(UndeliverableLineRejected);

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);

  if (stored === null) {
    throw new Error("Expected the check.");
  }

  expect(lineOf(stored, "line_delivered")?.state).toBe("delivered");
  expect(dining.saved).toEqual([]);
  expect(hub.published).toEqual([]);
});
