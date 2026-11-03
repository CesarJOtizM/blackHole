import { expect, it } from "vitest";

import { InMemoryAuditRepository } from "#adapters/memory/in-memory-audit-repository.js";
import {
  DetectUnusualBehavior,
  type UnusualBehaviorAlert,
  type VenueUnusualBehaviorThresholds,
} from "#application/detect-unusual-behavior/detect-unusual-behavior.js";
import { DetectUnusualBehavior as DetectUnusualBehaviorPort } from "#application/entry-port.js";
import type { AuditEvent } from "#application/ports/audit-repository.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const TENANT_ID = "organization_company_1";
const WAITER_ID = "user_waiter";
const SUPERVISOR_ID = "user_supervisor";
const SHIFT_ID = "shift_1";
const SITE_ID = "organization_venue_1";
const DEVICE_ID = "device_register";
const GENESIS = "0".repeat(64);
const PIN_SECRET = "1357";

const executed = (
  value: number,
  shiftId: string,
  kitchen: "before" | "after" | null,
) => ({
  value,
  shiftId,
  kitchen,
});

let sequence = 0;

const event = (
  action: string,
  before: unknown,
  after: unknown,
  overrides: Partial<AuditEvent> = {},
): AuditEvent => {
  sequence += 1;

  return {
    tenantId: TENANT_ID,
    actorId: WAITER_ID,
    authorizerId: null,
    deviceId: DEVICE_ID,
    siteId: SITE_ID,
    action,
    entity: `check_${sequence}`,
    before,
    after,
    reason: action,
    occurredAt: 1_700_000_000_000,
    sequence,
    previousHash: GENESIS,
    digest: "ab".repeat(32),
    kind: "event",
    ...overrides,
  };
};

const voidAfter = (overrides: Partial<AuditEvent> = {}): AuditEvent =>
  event(
    PERMISSION.SALE_VOID_AFTER_KITCHEN,
    executed(0, SHIFT_ID, "after"),
    executed(1, SHIFT_ID, "after"),
    { authorizerId: SUPERVISOR_ID, ...overrides },
  );

const discount = (overrides: Partial<AuditEvent> = {}): AuditEvent =>
  event(
    PERMISSION.SALE_DISCOUNT,
    executed(0, SHIFT_ID, null),
    executed(10, SHIFT_ID, null),
    overrides,
  );

const failedPin = (
  attempt: number,
  overrides: Partial<AuditEvent> = {},
  pin?: string,
): AuditEvent =>
  event(
    "pin.confirmation-failed",
    { status: "pending", attempts: attempt },
    {
      status: "pending",
      attempts: attempt + 1,
      requestId: "authorization_request_1",
      targetId: "check_1",
      shiftId: SHIFT_ID,
      ...(pin === undefined ? {} : { pin }),
    },
    overrides,
  );

const selfVoid = (entity: string): AuditEvent =>
  event(
    PERMISSION.SALE_VOID_AFTER_KITCHEN,
    executed(0, SHIFT_ID, "after"),
    { ...executed(1, SHIFT_ID, "after"), selfAuthorized: true },
    {
      actorId: SUPERVISOR_ID,
      authorizerId: SUPERVISOR_ID,
      entity,
    },
  );

const appendCopies = async (
  audits: InMemoryAuditRepository,
  count: number,
  create: (index: number) => AuditEvent,
): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await audits.append(create(index));
  }
};

const detect = (
  audits: InMemoryAuditRepository,
  venueThresholds?: VenueUnusualBehaviorThresholds,
): Promise<readonly UnusualBehaviorAlert[]> =>
  new DetectUnusualBehavior(audits).execute({
    tenantId: TENANT_ID,
    siteId: SITE_ID,
    shiftId: SHIFT_ID,
    ...(venueThresholds === undefined ? {} : { venueThresholds }),
  });

it("given the published seed and one self-authorized void, when detectors run, then only that self-authorization alerts", async () => {
  const audits = new InMemoryAuditRepository();
  await appendCopies(audits, 5, () => voidAfter());
  await appendCopies(audits, 5, () =>
    voidAfter({ actorId: "user_other", entity: "check_other" }),
  );
  await audits.append(selfVoid("check_self"));
  await audits.append(
    voidAfter({
      after: { ...executed(1, SHIFT_ID, "after"), approved: false },
    }),
  );
  await audits.append(
    event(
      PERMISSION.SALE_VOID_AFTER_KITCHEN,
      executed(1, SHIFT_ID, "after"),
      executed(1, SHIFT_ID, "after"),
      { authorizerId: SUPERVISOR_ID },
    ),
  );
  await audits.append(voidAfter({ kind: "altered" }));
  await audits.append(
    event(
      PERMISSION.SALE_VOID_BEFORE_KITCHEN,
      executed(0, SHIFT_ID, "before"),
      executed(1, SHIFT_ID, "before"),
    ),
  );
  await audits.append(
    voidAfter({
      after: executed(1, "shift_other", "after"),
    }),
  );
  await audits.append(voidAfter({ siteId: "organization_venue_2" }));
  await appendCopies(audits, 5, () => discount());
  await appendCopies(audits, 5, (index) => failedPin(index));
  await audits.append(failedPin(0, { kind: "altered" }, PIN_SECRET));
  await audits.append(failedPin(9, { deviceId: "device_other" }));
  await audits.append(
    event(
      "pin.confirmation-failed",
      { status: "pending" },
      {
        status: "pending",
        requestId: "authorization_request_1",
        pin: PIN_SECRET,
      },
    ),
  );

  const alerts = await detect(audits);

  expect(DetectUnusualBehaviorPort).toBe(DetectUnusualBehavior);
  expect(alerts).toEqual([
    {
      kind: "self-authorization",
      actorId: SUPERVISOR_ID,
      shiftId: SHIFT_ID,
      action: PERMISSION.SALE_VOID_AFTER_KITCHEN,
      entity: "check_self",
    },
  ]);
  expect(JSON.stringify(alerts)).not.toContain(PIN_SECRET);
});

it("given six voids after kitchen, six discounts, six pairs, and six failed PINs, when detectors run, then each pattern alerts without the PIN", async () => {
  const audits = new InMemoryAuditRepository();
  await appendCopies(audits, 6, () => voidAfter());
  await appendCopies(audits, 6, () => discount());
  await appendCopies(audits, 6, (index) =>
    failedPin(index, {}, index === 0 ? PIN_SECRET : undefined),
  );
  await appendCopies(audits, 5, (index) =>
    failedPin(index, { deviceId: "device_other" }),
  );

  const alerts = await detect(audits);

  expect(alerts).toEqual([
    {
      kind: "voids-after-kitchen",
      actorId: WAITER_ID,
      shiftId: SHIFT_ID,
      count: 6,
    },
    {
      kind: "discounts",
      actorId: WAITER_ID,
      shiftId: SHIFT_ID,
      count: 6,
    },
    {
      kind: "requester-authorizer-pair",
      actorId: WAITER_ID,
      authorizerId: SUPERVISOR_ID,
      shiftId: SHIFT_ID,
      count: 6,
    },
    {
      kind: "failed-pin",
      deviceId: DEVICE_ID,
      shiftId: SHIFT_ID,
      count: 6,
    },
  ]);
  expect(JSON.stringify(alerts)).not.toContain(PIN_SECRET);
});

it("given venue thresholds above six, when six discounts, pairs, and failed PINs sit beside six voids and one self-authorization, then only the void seed and that self-authorization alert", async () => {
  const audits = new InMemoryAuditRepository();
  const venueThresholds: VenueUnusualBehaviorThresholds = {
    discount: 8,
    requesterAuthorizerPair: 8,
    failedPin: 8,
  };
  await appendCopies(audits, 6, () => voidAfter());
  await appendCopies(audits, 6, () => discount());
  await appendCopies(audits, 6, (index) => failedPin(index, {}, PIN_SECRET));
  await audits.append(selfVoid("check_self"));

  const alerts = await detect(audits, venueThresholds);

  expect(alerts).toEqual([
    {
      kind: "voids-after-kitchen",
      actorId: WAITER_ID,
      shiftId: SHIFT_ID,
      count: 6,
    },
    {
      kind: "self-authorization",
      actorId: SUPERVISOR_ID,
      shiftId: SHIFT_ID,
      action: PERMISSION.SALE_VOID_AFTER_KITCHEN,
      entity: "check_self",
    },
  ]);
  expect(JSON.stringify(alerts)).not.toContain(PIN_SECRET);
});
