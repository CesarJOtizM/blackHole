import {
  type EvaluatePermission,
  PERMISSION,
  type RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";

import type { NoRestockToday } from "#domain/no-restock-today.js";

const BOGOTA_TIME_ZONE = "America/Bogota";

export interface NoRestockMarkQuery {
  tenantId: string;
  venueId: string;
  productId: string;
}

export abstract class NoRestockConfirmationStore {
  abstract find(query: NoRestockMarkQuery): Promise<NoRestockToday | null>;

  abstract save(mark: NoRestockToday): Promise<void>;
}

export interface ConfirmNoRestockTodayInput {
  tenantId: string;
  venueId: string;
  productId: string;
  actorId: string;
  sessionId: string;
  deviceId: string;
  at: Date;
}

export interface ConfirmNoRestockTodayResult {
  today: string;
  mark: NoRestockToday;
}

export class NoRestockTodayDisabled extends Error {
  constructor() {
    super("Not restocked today is disabled.");
    this.name = "NoRestockTodayDisabled";
  }
}

export class NoRestockNotPermitted extends Error {
  constructor() {
    super("This person cannot confirm not restocked today.");
    this.name = "NoRestockNotPermitted";
  }
}

export class UnknownNoRestockMark extends Error {
  constructor() {
    super("There is no not-restocked mark for this product.");
    this.name = "UnknownNoRestockMark";
  }
}

const bogotaCalendarDate = (instant: Date): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
};

export class ConfirmNoRestockToday {
  constructor(
    private readonly marks: NoRestockConfirmationStore,
    private readonly permissions: EvaluatePermission,
    private readonly audits: RecordAuditEvent,
    private readonly noRestockTodayEnabled: boolean,
  ) {}

  async execute(
    input: ConfirmNoRestockTodayInput,
  ): Promise<ConfirmNoRestockTodayResult> {
    if (!this.noRestockTodayEnabled) {
      throw new NoRestockTodayDisabled();
    }

    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.INVENTORY_CONFIRM_NO_RESTOCK,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      throw new NoRestockNotPermitted();
    }

    const mark = await this.marks.find({
      tenantId: input.tenantId,
      venueId: input.venueId,
      productId: input.productId,
    });

    if (mark === null) {
      throw new UnknownNoRestockMark();
    }

    const today = bogotaCalendarDate(input.at);
    const wasProposed = mark.statusAt(input.at) === "proposed";

    mark.confirm({ actorId: input.actorId, at: input.at });

    if (wasProposed) {
      await this.marks.save(mark);
      await this.audits.execute({
        tenantId: input.tenantId,
        actorId: input.actorId,
        authorizerId: null,
        deviceId: input.deviceId,
        siteId: input.venueId,
        action: PERMISSION.INVENTORY_CONFIRM_NO_RESTOCK,
        entity: input.productId,
        before: { status: "proposed" },
        after: {
          status: "confirmed",
          productId: input.productId,
          actorId: input.actorId,
          serviceDate: mark.serviceDate,
          tables: [],
        },
        reason: "Not restocked today",
      });
    }

    return { today, mark };
  }
}
