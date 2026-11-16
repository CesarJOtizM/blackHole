import { NO_RESTOCK_STATUS, NoRestockToday } from "#domain/no-restock-today.js";

const UNCOVERED = {
  pointPortions: 0,
  supplyingWarehousePortions: 0,
  inboundTransfers: [],
} as const;

const PERSISTED_STATUSES = [
  NO_RESTOCK_STATUS.PROPOSED,
  NO_RESTOCK_STATUS.CONFIRMED,
  NO_RESTOCK_STATUS.REMOVED,
] as const;

export type PersistedNoRestockStatus = (typeof PERSISTED_STATUSES)[number];

export interface NoRestockMarkQuery {
  tenantId: string;
  venueId: string;
  productId: string;
}

export interface StoredNoRestockMark extends NoRestockMarkQuery {
  status: PersistedNoRestockStatus;
  actorId: string | null;
  serviceDate: string | null;
}

export abstract class NoRestockRepository {
  abstract save(mark: NoRestockToday): Promise<void>;

  abstract find(query: NoRestockMarkQuery): Promise<NoRestockToday | null>;
}

const instantOnServiceDate = (serviceDate: string): Date =>
  new Date(`${serviceDate}T17:00:00.000Z`);

export const persistedNoRestockStatus = (
  value: string,
): PersistedNoRestockStatus => {
  if (
    value === NO_RESTOCK_STATUS.PROPOSED ||
    value === NO_RESTOCK_STATUS.CONFIRMED ||
    value === NO_RESTOCK_STATUS.REMOVED
  ) {
    return value;
  }

  throw new Error("The stored not-restocked status is unknown.");
};

export const snapshotNoRestockToday = (
  mark: NoRestockToday,
): StoredNoRestockMark => {
  if (mark.serviceDate === null) {
    return {
      tenantId: mark.tenantId,
      venueId: mark.venueId,
      productId: mark.productId,
      status: NO_RESTOCK_STATUS.PROPOSED,
      actorId: null,
      serviceDate: null,
    };
  }

  const status = mark.statusAt(instantOnServiceDate(mark.serviceDate));

  if (
    status !== NO_RESTOCK_STATUS.CONFIRMED &&
    status !== NO_RESTOCK_STATUS.REMOVED
  ) {
    throw new Error("A dated not-restocked mark is missing its stored status.");
  }

  if (mark.actorId === null) {
    throw new Error("A dated not-restocked mark is missing its actor.");
  }

  return {
    tenantId: mark.tenantId,
    venueId: mark.venueId,
    productId: mark.productId,
    status,
    actorId: mark.actorId,
    serviceDate: mark.serviceDate,
  };
};

export const restoreNoRestockToday = (
  stored: StoredNoRestockMark,
): NoRestockToday => {
  const mark = NoRestockToday.propose({
    tenantId: stored.tenantId,
    venueId: stored.venueId,
    productId: stored.productId,
    coverage: UNCOVERED,
  });

  if (mark === null) {
    throw new Error("A stored not-restocked mark could not be restored.");
  }

  if (stored.status === NO_RESTOCK_STATUS.PROPOSED) {
    return mark;
  }

  if (stored.actorId === null || stored.serviceDate === null) {
    throw new Error("A confirmed not-restocked mark is missing its stamp.");
  }

  mark.confirm({
    actorId: stored.actorId,
    at: instantOnServiceDate(stored.serviceDate),
  });

  if (stored.status === NO_RESTOCK_STATUS.REMOVED) {
    mark.remove({ actorId: stored.actorId });
  }

  return mark;
};
