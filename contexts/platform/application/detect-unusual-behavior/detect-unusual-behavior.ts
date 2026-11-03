import type {
  AuditEvent,
  AuditRepository,
} from "#application/ports/audit-repository.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const FAILED_PIN_ACTION = "pin.confirmation-failed";
const PUBLISHED_SEED = 5;

export interface VenueUnusualBehaviorThresholds {
  discount: number;
  requesterAuthorizerPair: number;
  failedPin: number;
}

export interface DetectUnusualBehaviorQuery {
  tenantId: string;
  siteId: string;
  shiftId: string;
  venueThresholds?: VenueUnusualBehaviorThresholds;
}

export type UnusualBehaviorAlert =
  | {
      kind: "voids-after-kitchen";
      actorId: string;
      shiftId: string;
      count: number;
    }
  | {
      kind: "discounts";
      actorId: string;
      shiftId: string;
      count: number;
    }
  | {
      kind: "requester-authorizer-pair";
      actorId: string;
      authorizerId: string;
      shiftId: string;
      count: number;
    }
  | {
      kind: "self-authorization";
      actorId: string;
      shiftId: string;
      action: string;
      entity: string;
    }
  | {
      kind: "failed-pin";
      deviceId: string;
      shiftId: string;
      count: number;
    };

interface ExecutedOperation {
  value: number;
  shiftId: string;
  kitchen: "before" | "after" | null;
}

interface Tally {
  voids: Map<string, number>;
  discounts: Map<string, number>;
  pairs: Map<string, Map<string, number>>;
  selfAuthorizations: UnusualBehaviorAlert[];
  failedPins: Map<string, number>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameState = (before: unknown, after: unknown): boolean =>
  JSON.stringify(before) === JSON.stringify(after);

const executedOperation = (after: unknown): ExecutedOperation | null => {
  if (!isRecord(after)) {
    return null;
  }

  const { value, shiftId, kitchen } = after;

  if (
    typeof value !== "number" ||
    typeof shiftId !== "string" ||
    (kitchen !== "before" && kitchen !== "after" && kitchen !== null)
  ) {
    return null;
  }

  return { value, shiftId, kitchen };
};

const deniedDecision = (after: unknown): boolean =>
  isRecord(after) && after.approved === false;

const counts = (
  event: AuditEvent,
  query: DetectUnusualBehaviorQuery,
  operation: ExecutedOperation,
): boolean =>
  event.kind === "event" &&
  event.siteId === query.siteId &&
  event.action !== FAILED_PIN_ACTION &&
  operation.shiftId === query.shiftId &&
  !deniedDecision(event.after) &&
  !sameState(event.before, event.after);

const shiftIdOf = (after: unknown): string | null => {
  if (!isRecord(after) || typeof after.shiftId !== "string") {
    return null;
  }

  return after.shiftId;
};

const countsFailedPin = (
  event: AuditEvent,
  query: DetectUnusualBehaviorQuery,
): boolean =>
  event.kind === "event" &&
  event.siteId === query.siteId &&
  event.action === FAILED_PIN_ACTION &&
  shiftIdOf(event.after) === query.shiftId &&
  !sameState(event.before, event.after);

const selfAuthorized = (event: AuditEvent): boolean => {
  if (event.authorizerId !== null && event.authorizerId === event.actorId) {
    return true;
  }

  return isRecord(event.after) && event.after.selfAuthorized === true;
};

const increment = (countsByKey: Map<string, number>, key: string): void => {
  countsByKey.set(key, (countsByKey.get(key) ?? 0) + 1);
};

const incrementPair = (
  pairs: Map<string, Map<string, number>>,
  actorId: string,
  authorizerId: string,
): void => {
  const byAuthorizer = pairs.get(actorId) ?? new Map<string, number>();
  increment(byAuthorizer, authorizerId);
  pairs.set(actorId, byAuthorizer);
};

const emptyTally = (): Tally => ({
  voids: new Map(),
  discounts: new Map(),
  pairs: new Map(),
  selfAuthorizations: [],
  failedPins: new Map(),
});

const venueSeeds = (
  query: DetectUnusualBehaviorQuery,
): VenueUnusualBehaviorThresholds => ({
  discount: query.venueThresholds?.discount ?? PUBLISHED_SEED,
  requesterAuthorizerPair:
    query.venueThresholds?.requesterAuthorizerPair ?? PUBLISHED_SEED,
  failedPin: query.venueThresholds?.failedPin ?? PUBLISHED_SEED,
});

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
};

const countedByActor = (
  kind: "voids-after-kitchen" | "discounts",
  countsByActor: Map<string, number>,
  seed: number,
  shiftId: string,
): UnusualBehaviorAlert[] =>
  [...countsByActor.entries()]
    .filter(([, count]) => count > seed)
    .sort(([left], [right]) => compareText(left, right))
    .map(([actorId, count]) => ({ kind, actorId, shiftId, count }));

const pairAlerts = (
  pairs: Map<string, Map<string, number>>,
  seed: number,
  shiftId: string,
): UnusualBehaviorAlert[] => {
  const alerts: UnusualBehaviorAlert[] = [];

  for (const [actorId, byAuthorizer] of [...pairs.entries()].sort(
    ([left], [right]) => compareText(left, right),
  )) {
    for (const [authorizerId, count] of [...byAuthorizer.entries()].sort(
      ([left], [right]) => compareText(left, right),
    )) {
      if (count > seed) {
        alerts.push({
          kind: "requester-authorizer-pair",
          actorId,
          authorizerId,
          shiftId,
          count,
        });
      }
    }
  }

  return alerts;
};

const failedPinAlerts = (
  failedPins: Map<string, number>,
  seed: number,
  shiftId: string,
): UnusualBehaviorAlert[] =>
  [...failedPins.entries()]
    .filter(([, count]) => count > seed)
    .sort(([left], [right]) => compareText(left, right))
    .map(([deviceId, count]) => ({
      kind: "failed-pin",
      deviceId,
      shiftId,
      count,
    }));

const observe = (
  tally: Tally,
  event: AuditEvent,
  query: DetectUnusualBehaviorQuery,
): void => {
  if (countsFailedPin(event, query)) {
    increment(tally.failedPins, event.deviceId);
    return;
  }

  const operation = executedOperation(event.after);

  if (operation === null || !counts(event, query, operation)) {
    return;
  }

  if (
    event.action === PERMISSION.SALE_VOID_AFTER_KITCHEN &&
    operation.kitchen === "after"
  ) {
    increment(tally.voids, event.actorId);
  }

  if (event.action === PERMISSION.SALE_DISCOUNT) {
    increment(tally.discounts, event.actorId);
  }

  if (event.authorizerId !== null && event.authorizerId !== event.actorId) {
    incrementPair(tally.pairs, event.actorId, event.authorizerId);
  }

  if (selfAuthorized(event)) {
    tally.selfAuthorizations.push({
      kind: "self-authorization",
      actorId: event.actorId,
      shiftId: query.shiftId,
      action: event.action,
      entity: event.entity,
    });
  }
};

const alertsFrom = (
  tally: Tally,
  query: DetectUnusualBehaviorQuery,
): readonly UnusualBehaviorAlert[] => {
  const seeds = venueSeeds(query);

  return [
    ...countedByActor(
      "voids-after-kitchen",
      tally.voids,
      PUBLISHED_SEED,
      query.shiftId,
    ),
    ...countedByActor(
      "discounts",
      tally.discounts,
      seeds.discount,
      query.shiftId,
    ),
    ...pairAlerts(tally.pairs, seeds.requesterAuthorizerPair, query.shiftId),
    ...tally.selfAuthorizations,
    ...failedPinAlerts(tally.failedPins, seeds.failedPin, query.shiftId),
  ];
};

export class DetectUnusualBehavior {
  constructor(private readonly audits: AuditRepository) {}

  async execute(
    query: DetectUnusualBehaviorQuery,
  ): Promise<readonly UnusualBehaviorAlert[]> {
    const tally = emptyTally();
    const stored = await this.audits.list(query.tenantId, null);

    for (const event of stored) {
      observe(tally, event, query);
    }

    return alertsFrom(tally, query);
  }
}
