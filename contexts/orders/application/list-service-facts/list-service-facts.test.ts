import { ListServiceFacts as ListedOnEntryPort } from "@blackhole/orders/application/entry-port";
import { expect, it } from "vitest";
import { ListServiceFacts } from "#application/list-service-facts/list-service-facts.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { Check } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const VOID_SINK_ID = "check_void_sink";
const FROM = "2026-10-28T05:00:00.000Z";
const TO = "2026-10-29T05:00:00.000Z";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:10:00.000Z";
const IN_PREPARATION_AT = "2026-10-28T12:20:00.000Z";
const READY_AT = "2026-10-28T12:40:00.000Z";
const DELIVERED_AT = "2026-10-28T12:55:00.000Z";
const REQUESTED_AT = "2026-10-28T13:00:00.000Z";
const RELEASED_AT = "2026-10-28T13:10:00.000Z";
const CHARGED_AT = "2026-10-28T13:20:00.000Z";
const OUTSIDE_AT = "2026-10-27T12:00:00.000Z";
const STATION_ID = "station_grill";

class MemoryDiningRoom extends DiningRoomRepository {
  constructor(private readonly checks: readonly Check[]) {
    super();
  }

  override async load(): Promise<DiningTable | null> {
    return null;
  }

  override async save(_table: DiningTable): Promise<void> {}

  override async loadCheck(): Promise<Check | null> {
    return null;
  }

  override async saveCheck(_check: Check): Promise<void> {}

  override async saveChecks(_checks: readonly Check[]): Promise<void> {}

  override async listChecks(
    tenantId: string,
    venueId: string,
  ): Promise<readonly Check[]> {
    return this.checks.filter(
      (check) => check.tenantId === tenantId && check.venueId === venueId,
    );
  }
}

const seated = (): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
    diners: 4,
  });

  check.addLine({
    orderId: "order_waiter",
    lineId: "line_soup",
    productId: "menu_soup",
    name: "Soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
  });
  check.addLine({
    orderId: "order_qr",
    lineId: "line_qr",
    productId: "menu_arepa",
    name: "Arepa",
    course: 2,
    price: 4_000,
    channel: "qr_table",
  });
  check.assignWaiter("user_waiter");
  check.send({ course: 1, sentAt: SENT_AT });
  check.advance({
    lineId: "line_soup",
    state: "in_preparation",
    at: IN_PREPARATION_AT,
    stationId: STATION_ID,
  });
  check.advance({
    lineId: "line_soup",
    state: "ready",
    at: READY_AT,
  });
  check.advance({
    lineId: "line_soup",
    state: "delivered",
    at: DELIVERED_AT,
  });
  check.requestCheck({ requestedAt: REQUESTED_AT });
  check.stampReleased({ releasedAt: RELEASED_AT });
  check.stampCharged({ chargedAt: CHARGED_AT });

  return check;
};

const voided = (): Check => {
  const check = Check.open({
    id: VOID_SINK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: "order_void",
    lineId: "line_voided",
    productId: "menu_juice",
    name: "Juice",
    course: 1,
    price: 8_000,
    channel: "fixed_point",
  });

  return check;
};

const outside = (): Check => {
  const check = Check.open({
    id: "check_outside",
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OUTSIDE_AT,
    diners: 9,
  });

  check.addLine({
    orderId: "order_outside",
    lineId: "line_outside",
    productId: "menu_old",
    name: "Old",
    course: 1,
    price: 99_000,
    channel: "waiter",
  });

  return check;
};

it("given the orders entry port, when service facts are resolved, then the port exposes the same use case", () => {
  expect(ListedOnEntryPort).toBe(ListServiceFacts);
});

it("given seated and voided lines, when service facts are listed, then channel, diners, discounts, and voids are kept", async () => {
  const listed = new ListServiceFacts(
    new MemoryDiningRoom([outside(), voided(), seated()]),
  );

  const result = await listed.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    from: FROM,
    to: TO,
  });

  expect(result).toEqual([
    {
      checkId: CHECK_ID,
      lineId: "line_qr",
      channel: "qr_table",
      diners: 4,
      grossCop: 4_000,
      discountCop: 0,
      voided: false,
      waiterId: "user_waiter",
      stationId: null,
      openedAt: OPENED_AT,
      chargedAt: CHARGED_AT,
      releasedAt: RELEASED_AT,
      requestedAt: REQUESTED_AT,
      sentAt: null,
      inPreparationAt: null,
      readyAt: null,
      deliveredAt: null,
    },
    {
      checkId: CHECK_ID,
      lineId: "line_soup",
      channel: "waiter",
      diners: 4,
      grossCop: 12_000,
      discountCop: 0,
      voided: false,
      waiterId: "user_waiter",
      stationId: STATION_ID,
      openedAt: OPENED_AT,
      chargedAt: CHARGED_AT,
      releasedAt: RELEASED_AT,
      requestedAt: REQUESTED_AT,
      sentAt: SENT_AT,
      inPreparationAt: IN_PREPARATION_AT,
      readyAt: READY_AT,
      deliveredAt: DELIVERED_AT,
    },
    {
      checkId: VOID_SINK_ID,
      lineId: "line_voided",
      channel: "fixed_point",
      diners: null,
      grossCop: 8_000,
      discountCop: 0,
      voided: true,
      waiterId: null,
      stationId: null,
      openedAt: OPENED_AT,
      chargedAt: null,
      releasedAt: null,
      requestedAt: null,
      sentAt: null,
      inPreparationAt: null,
      readyAt: null,
      deliveredAt: null,
    },
  ]);
});
