import type { RecordAuditEvent } from "@blackhole/platform/application/entry-port";

import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { type Check, TableNotOpen } from "#domain/check.js";

export interface GuestToldQuery {
  tenantId: string;
  venueId: string;
  checkId: string;
  lineId: string;
}

export interface GuestToldRecord {
  checkId: string;
  lineId: string;
  actorId: string;
}

export abstract class GuestToldStore {
  abstract find(query: GuestToldQuery): Promise<GuestToldRecord | null>;

  abstract save(record: GuestToldQuery & GuestToldRecord): Promise<void>;
}

export interface ConfirmGuestToldInput extends GuestToldQuery {
  actorId: string;
  deviceId: string;
}

export interface PendingGuestNotice {
  checkId: string;
  tableId: string;
  lineId: string;
  productId: string;
}

export class MissingGuestActor extends Error {
  constructor() {
    super("Telling the guest requires an identified person.");
    this.name = "MissingGuestActor";
  }
}

export class GuestToldRejected extends Error {
  constructor() {
    super("Only a withdrawn line can be marked as told to the guest.");
    this.name = "GuestToldRejected";
  }
}

const hasActor = (actorId: string): boolean => actorId.trim().length > 0;

const lineOf = (check: Check, lineId: string) =>
  check.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId);

export class ConfirmGuestTold {
  constructor(
    private readonly diningRoom: DiningRoomRepository,
    private readonly told: GuestToldStore,
    private readonly audits: RecordAuditEvent,
  ) {}

  async pending(
    tenantId: string,
    venueId: string,
  ): Promise<readonly PendingGuestNotice[]> {
    const checks = await this.diningRoom.listChecks(tenantId, venueId);
    const notices: PendingGuestNotice[] = [];

    for (const check of checks) {
      if (check.tenantId !== tenantId || check.venueId !== venueId) {
        continue;
      }

      for (const order of check.orders) {
        for (const line of order.lines) {
          if (line.state !== "not_delivered") {
            continue;
          }

          const existing = await this.told.find({
            tenantId,
            venueId,
            checkId: check.id,
            lineId: line.id,
          });

          if (existing !== null) {
            continue;
          }

          notices.push({
            checkId: check.id,
            tableId: check.tableId,
            lineId: line.id,
            productId: line.productId,
          });
        }
      }
    }

    return notices;
  }

  async execute(input: ConfirmGuestToldInput): Promise<GuestToldRecord> {
    if (!hasActor(input.actorId)) {
      throw new MissingGuestActor();
    }

    const existing = await this.told.find(input);

    if (existing !== null) {
      return existing;
    }

    const check = await this.diningRoom.loadCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (check === null) {
      throw new TableNotOpen();
    }

    const line = lineOf(check, input.lineId);

    if (line === undefined || line.state !== "not_delivered") {
      throw new GuestToldRejected();
    }

    const record: GuestToldRecord = {
      checkId: input.checkId,
      lineId: input.lineId,
      actorId: input.actorId,
    };

    await this.told.save({
      tenantId: input.tenantId,
      venueId: input.venueId,
      ...record,
    });
    await this.audits.execute({
      tenantId: input.tenantId,
      actorId: input.actorId,
      authorizerId: null,
      deviceId: input.deviceId,
      siteId: input.venueId,
      action: "orders.guest-told",
      entity: input.lineId,
      before: { told: false },
      after: {
        checkId: input.checkId,
        lineId: input.lineId,
        actorId: input.actorId,
        tableId: check.tableId,
        productId: line.productId,
      },
      reason: "Customer notified",
    });

    return record;
  }
}
