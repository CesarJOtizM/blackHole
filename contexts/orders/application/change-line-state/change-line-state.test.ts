import { expect, it, vi } from "vitest";
import { ChangeLineState } from "#application/change-line-state/change-line-state.js";
import { Clock } from "#application/ports/clock.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import {
  RealtimeHub,
  type RealtimeNotice,
} from "#application/ports/realtime-hub.js";
import {
  Check,
  type LineState,
  LineTransitionRejected,
} from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const ORDER_ID = "order_1";
const LINE_ID = "line_soup";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:03:10.000Z";
const PREPARED_AT = "2026-10-28T12:05:00.000Z";
const READY_AT = "2026-10-28T12:11:00.000Z";
const DELIVERED_AT = "2026-10-28T12:16:00.000Z";

class FixedClock extends Clock {
  constructor(private readonly instant: number) {
    super();
  }

  override now(): number {
    return this.instant;
  }
}

class SequenceClock extends Clock {
  private index = 0;

  constructor(private readonly instants: readonly number[]) {
    super();
  }

  override now(): number {
    const instant = this.instants[this.index];

    if (instant === undefined) {
      throw new Error("The clock has no more instants.");
    }

    this.index += 1;
    return instant;
  }
}

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

class MemoryHub extends RealtimeHub {
  readonly published: RealtimeNotice[] = [];

  override async publish(notice: RealtimeNotice): Promise<void> {
    this.published.push(notice);
  }
}

const command = (state: LineState) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  lineId: LINE_ID,
  state,
});

const openSentCheck = (): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: ORDER_ID,
    lineId: LINE_ID,
    productId: "menu_product_soup",
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: SENT_AT });

  return check;
};

const openReadyCheck = (): Check => {
  const check = openSentCheck();

  check.advance({
    lineId: LINE_ID,
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({ lineId: LINE_ID, state: "ready", at: READY_AT });

  return check;
};

const harness = async (check: Check, clock: Clock) => {
  const dining = new MemoryDiningRoom();
  const hub = new MemoryHub();

  await dining.saveCheck(check);

  return {
    dining,
    hub,
    change: new ChangeLineState(dining, clock, hub),
  };
};

it("given a sent line, when it is advanced to ready, then both stamps are stored and the waiter notice carries the table id", async () => {
  const { dining, hub, change } = await harness(
    openSentCheck(),
    new SequenceClock([Date.parse(PREPARED_AT), Date.parse(READY_AT)]),
  );
  const save = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");

  await change.execute(command("in_preparation"));
  await change.execute(command("ready"));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.orders[0]?.lines[0]).toMatchObject({
    state: "ready",
    sentAt: SENT_AT,
    inPreparationAt: PREPARED_AT,
    readyAt: READY_AT,
  });
  expect(stored?.readyNotices).toEqual([
    { tableId: TABLE_ID, lineId: LINE_ID, at: READY_AT },
  ]);
  expect(hub.published).toEqual([
    {
      kind: "line_ready",
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      lineId: LINE_ID,
      at: READY_AT,
    },
  ]);
  expect(saveCheck).toHaveBeenCalledTimes(2);
  expect(save).not.toHaveBeenCalled();
  expect(saveChecks).not.toHaveBeenCalled();
});

it("given a step back, when the line is set back to sent, then nothing is saved", async () => {
  const { dining, hub, change } = await harness(
    openReadyCheck(),
    new FixedClock(Date.parse(DELIVERED_AT)),
  );
  const save = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");
  const publish = vi.spyOn(hub, "publish");

  const stepBack = change.execute(command("sent"));

  await expect(stepBack).rejects.toThrow(LineTransitionRejected);
  expect(save).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
  expect(saveChecks).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.orders[0]?.lines[0]).toMatchObject({
    state: "ready",
    inPreparationAt: PREPARED_AT,
    readyAt: READY_AT,
  });
  expect(stored?.readyNotices).toEqual([
    { tableId: TABLE_ID, lineId: LINE_ID, at: READY_AT },
  ]);
});

it("given a ready line, when it is delivered, then the line is delivered", async () => {
  const { dining, hub, change } = await harness(
    openReadyCheck(),
    new FixedClock(Date.parse(DELIVERED_AT)),
  );
  const saveCheck = vi.spyOn(dining, "saveCheck");

  await change.execute(command("delivered"));

  const stored = await dining.loadCheck(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.orders[0]?.lines[0]).toMatchObject({
    state: "delivered",
    sentAt: SENT_AT,
    inPreparationAt: PREPARED_AT,
    readyAt: READY_AT,
    deliveredAt: DELIVERED_AT,
  });
  expect(stored?.readyNotices).toEqual([
    { tableId: TABLE_ID, lineId: LINE_ID, at: READY_AT },
  ]);
  expect(hub.published).toEqual([]);
  expect(saveCheck).toHaveBeenCalledOnce();
});
