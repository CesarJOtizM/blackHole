export const NO_RESTOCK_STATUS = {
  PROPOSED: "proposed",
  CONFIRMED: "confirmed",
  REMOVED: "removed",
  EXPIRED: "expired",
} as const;

export type NoRestockStatus =
  (typeof NO_RESTOCK_STATUS)[keyof typeof NO_RESTOCK_STATUS];

const BOGOTA_TIME_ZONE = "America/Bogota";

const BLOCKING_TRANSFER_STATUSES: ReadonlySet<string> = new Set([
  "dispatched",
  "in_transit",
]);

export class MissingActor extends Error {
  constructor() {
    super("Changing not restocked today requires an identified person.");
    this.name = "MissingActor";
  }
}

export interface InboundTransfer {
  status: string;
}

export interface PortionCoverage {
  pointPortions: number;
  supplyingWarehousePortions: number;
  inboundTransfers: readonly InboundTransfer[];
}

export interface ProposeNoRestockToday {
  tenantId: string;
  venueId: string;
  productId: string;
  coverage: PortionCoverage;
}

interface ActorChange {
  actorId: string | null;
}

interface ConfirmNoRestockToday extends ActorChange {
  at: Date;
}

const hasActor = (actorId: string | null): actorId is string =>
  actorId !== null && actorId.trim().length > 0;

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

const portionsCannotCover = (portions: number): boolean => portions < 1;

const transferOnTheWay = (transfers: readonly InboundTransfer[]): boolean =>
  transfers.some((transfer) => BLOCKING_TRANSFER_STATUSES.has(transfer.status));

const canPropose = (coverage: PortionCoverage): boolean =>
  portionsCannotCover(coverage.pointPortions) &&
  portionsCannotCover(coverage.supplyingWarehousePortions) &&
  !transferOnTheWay(coverage.inboundTransfers);

export class NoRestockToday {
  readonly tenantId: string;

  readonly venueId: string;

  readonly productId: string;

  private storedStatus: NoRestockStatus = NO_RESTOCK_STATUS.PROPOSED;

  private actorIdValue: string | null = null;

  private serviceDateValue: string | null = null;

  private constructor(tenantId: string, venueId: string, productId: string) {
    this.tenantId = tenantId;
    this.venueId = venueId;
    this.productId = productId;
  }

  static propose(input: ProposeNoRestockToday): NoRestockToday | null {
    if (!canPropose(input.coverage)) {
      return null;
    }

    return new NoRestockToday(input.tenantId, input.venueId, input.productId);
  }

  get actorId(): string | null {
    return this.actorIdValue;
  }

  get serviceDate(): string | null {
    return this.serviceDateValue;
  }

  statusAt(at: Date): NoRestockStatus {
    if (
      this.storedStatus === NO_RESTOCK_STATUS.CONFIRMED &&
      this.serviceDateValue !== null &&
      bogotaCalendarDate(at) > this.serviceDateValue
    ) {
      return NO_RESTOCK_STATUS.EXPIRED;
    }

    return this.storedStatus;
  }

  confirm(input: ConfirmNoRestockToday): void {
    if (!hasActor(input.actorId)) {
      throw new MissingActor();
    }

    if (this.storedStatus !== NO_RESTOCK_STATUS.PROPOSED) {
      return;
    }

    this.actorIdValue = input.actorId;
    this.serviceDateValue = bogotaCalendarDate(input.at);
    this.storedStatus = NO_RESTOCK_STATUS.CONFIRMED;
  }

  remove(input: ActorChange): void {
    if (!hasActor(input.actorId)) {
      throw new MissingActor();
    }

    if (this.storedStatus !== NO_RESTOCK_STATUS.CONFIRMED) {
      return;
    }

    this.storedStatus = NO_RESTOCK_STATUS.REMOVED;
  }
}
