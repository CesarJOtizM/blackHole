import { RecordAuditEvent } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";
import {
  ConfirmGuestTold,
  type GuestToldRecord,
  GuestToldStore,
} from "#application/confirm-guest-told/confirm-guest-told.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { Check } from "#domain/check.js";
import type { DiningTable } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const CHECK_ID = "check_4";
const TABLE_ID = "table_4";
const LINE_ID = "line_ribs";
const ACTOR_ID = "user_waiter";
const DEVICE_ID = "device_waiter";
const RIBS_ID = "menu_product_ribs";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:03:10.000Z";
const WITHDRAWN_AT = "2026-10-28T12:40:00.000Z";

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
    const index = this.checks.findIndex((stored) => stored.id === check.id);

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

class MemoryTold extends GuestToldStore {
  readonly saved: Array<
    GuestToldRecord & { tenantId: string; venueId: string }
  > = [];

  override async find(query: {
    tenantId: string;
    venueId: string;
    checkId: string;
    lineId: string;
  }): Promise<GuestToldRecord | null> {
    const found = this.saved.find(
      (record) =>
        record.tenantId === query.tenantId &&
        record.venueId === query.venueId &&
        record.checkId === query.checkId &&
        record.lineId === query.lineId,
    );

    if (found === undefined) {
      return null;
    }

    return {
      checkId: found.checkId,
      lineId: found.lineId,
      actorId: found.actorId,
    };
  }

  override async save(
    record: GuestToldRecord & { tenantId: string; venueId: string },
  ): Promise<void> {
    this.saved.push(record);
  }
}

class RecordingAudit extends RecordAuditEvent {
  readonly commands: Parameters<RecordAuditEvent["execute"]>[0][] = [];

  constructor() {
    super({} as never, {} as never, {} as never);
  }

  override execute(
    command: Parameters<RecordAuditEvent["execute"]>[0],
  ): ReturnType<RecordAuditEvent["execute"]> {
    this.commands.push(command);
    return Promise.resolve(
      {} as Awaited<ReturnType<RecordAuditEvent["execute"]>>,
    );
  }
}

const withdrawnRibs = (): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: "order_ribs",
    lineId: LINE_ID,
    productId: RIBS_ID,
    name: "Ribs",
    course: 1,
    price: 22_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: SENT_AT });
  check.withdrawUncoveredSent({
    productId: RIBS_ID,
    uncoveredPortions: 1,
    at: WITHDRAWN_AT,
  });

  return check;
};

const harness = () => {
  const dining = new MemoryDiningRoom();
  dining.seed(withdrawnRibs());
  const told = new MemoryTold();
  const audits = new RecordingAudit();

  return {
    dining,
    told,
    audits,
    useCase: new ConfirmGuestTold(dining, told, audits),
  };
};

it("given a withdrawn line the waiter has not confirmed, when the device opens, then the notice stays until orders.guest-told stores the check, line, and actor", async () => {
  const { told, audits, useCase } = harness();

  const before = await useCase.pending(TENANT_ID, VENUE_ID);

  expect(before).toEqual([
    {
      checkId: CHECK_ID,
      tableId: TABLE_ID,
      lineId: LINE_ID,
      productId: RIBS_ID,
    },
  ]);
  expect(told.saved).toEqual([]);
  expect(audits.commands).toEqual([]);

  const recorded = await useCase.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    lineId: LINE_ID,
    actorId: ACTOR_ID,
    deviceId: DEVICE_ID,
  });
  const again = await useCase.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    checkId: CHECK_ID,
    lineId: LINE_ID,
    actorId: ACTOR_ID,
    deviceId: DEVICE_ID,
  });
  const after = await useCase.pending(TENANT_ID, VENUE_ID);

  expect(recorded).toEqual({
    checkId: CHECK_ID,
    lineId: LINE_ID,
    actorId: ACTOR_ID,
  });
  expect(again).toEqual(recorded);
  expect(told.saved).toEqual([
    {
      tenantId: TENANT_ID,
      venueId: VENUE_ID,
      checkId: CHECK_ID,
      lineId: LINE_ID,
      actorId: ACTOR_ID,
    },
  ]);
  expect(audits.commands).toEqual([
    expect.objectContaining({
      actorId: ACTOR_ID,
      action: "orders.guest-told",
      after: expect.objectContaining({
        checkId: CHECK_ID,
        lineId: LINE_ID,
        actorId: ACTOR_ID,
        tableId: TABLE_ID,
      }),
    }),
  ]);
  expect(after).toEqual([]);
});
