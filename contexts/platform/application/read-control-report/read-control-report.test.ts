import { expect, it } from "vitest";

import {
  FakeAuthorizationClock,
  InMemoryIdentityReader,
  InMemorySessionReader,
} from "#adapters/memory/authorization-doubles.js";
import { InMemoryAuditRepository } from "#adapters/memory/in-memory-audit-repository.js";
import { InMemoryAuthorizationRepository } from "#adapters/memory/in-memory-authorization-repository.js";
import { ReadControlReport as ReadControlReportPort } from "#application/entry-port.js";
import { EvaluatePermission } from "#application/evaluate-permission/evaluate-permission.js";
import type { AuditEvent } from "#application/ports/audit-repository.js";
import {
  type ControlReport,
  ReadControlReport,
} from "#application/read-control-report/read-control-report.js";
import { Authorization } from "#domain/authorization.js";
import { PERMISSION } from "#domain/permission-catalog.js";

const TENANT_ID = "organization_company_1";
const SITE_ID = "organization_venue_1";
const OTHER_SITE_ID = "organization_venue_2";
const OWNER_ID = "user_owner";
const CASHIER_ID = "user_cashier";
const WAITER_ID = "user_waiter";
const SUPERVISOR_ID = "user_supervisor";
const SHIFT_ID = "shift_1";
const CASH_SHIFT_ID = "shift_cash";
const DEVICE_ID = "device_register";
const GENESIS = "0".repeat(64);
const PIN_SECRET = "1357";

const state = (value: number, kitchen: "before" | "after" | null) => ({
  value,
  shiftId: SHIFT_ID,
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
    authorizerId: SUPERVISOR_ID,
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
    state(0, "after"),
    state(1, "after"),
    { reason: "burned", ...overrides },
  );

const emptyReport = (): ControlReport => ({
  voids: [],
  discounts: [],
  courtesies: [],
  cashDifferences: [],
  drawerOpenings: [],
  reopenedOrEditedAfterPreBill: [],
});

const openReport = async (audits: InMemoryAuditRepository) => {
  const authorizations = new InMemoryAuthorizationRepository();
  const sessions = new InMemorySessionReader();
  const identities = new InMemoryIdentityReader();
  const authorization = Authorization.open(TENANT_ID);
  authorization.appointOwner({
    assignmentId: "assignment_owner",
    userId: OWNER_ID,
  });
  authorization.assign({
    assignmentId: "assignment_cashier",
    userId: CASHIER_ID,
    roleId: "cashier",
    scopeKind: "site",
    scopeId: SITE_ID,
    validFrom: null,
    validUntil: null,
    actorUserId: OWNER_ID,
    at: 0,
  });
  await authorizations.save(authorization, {
    before: Authorization.open(TENANT_ID).snapshot(),
    after: authorization.snapshot(),
  });
  identities.put(TENANT_ID, { userId: OWNER_ID, active: true });
  identities.put(TENANT_ID, { userId: CASHIER_ID, active: true });
  sessions.put(TENANT_ID, {
    sessionId: "session_owner",
    userId: OWNER_ID,
    displayName: "Owner",
    deviceId: DEVICE_ID,
    venueId: null,
    kind: "administration",
  });
  sessions.put(TENANT_ID, {
    sessionId: "session_cashier",
    userId: CASHIER_ID,
    displayName: "Cashier",
    deviceId: DEVICE_ID,
    venueId: SITE_ID,
    kind: "pin",
  });
  const report = new ReadControlReport(
    audits,
    new EvaluatePermission(
      authorizations,
      sessions,
      identities,
      new FakeAuthorizationClock(0),
    ),
  );

  return { report, authorizations };
};

it("given successful sensitive audits, when an owner with audit.view opens the control report, then it lists voids, discounts, courtesies, cash differences, openings, and accounts reopened or edited after the pre-bill", async () => {
  const audits = new InMemoryAuditRepository();
  await audits.append(voidAfter());
  await audits.append(
    event(
      PERMISSION.SALE_VOID_BEFORE_KITCHEN,
      state(0, "before"),
      state(1, "before"),
      { reason: "wrong item" },
    ),
  );
  await audits.append(
    event(PERMISSION.SALE_DISCOUNT, state(0, null), state(10, null), {
      actorId: CASHIER_ID,
      reason: "regular",
    }),
  );
  await audits.append(
    event(PERMISSION.SALE_COMP, state(0, null), state(20_000, null), {
      reason: "guest",
    }),
  );
  await audits.append(
    event(
      PERMISSION.CASH_APPROVE_VARIANCE,
      { value: 0, shiftId: CASH_SHIFT_ID, kitchen: null },
      { value: 1_500, shiftId: CASH_SHIFT_ID, kitchen: null },
      { actorId: CASHIER_ID, authorizerId: null, reason: "count" },
    ),
  );
  await audits.append(
    event("cash.drawer-opened", state(0, null), state(1, null), {
      actorId: CASHIER_ID,
      authorizerId: null,
      reason: "change fund",
    }),
  );
  await audits.append(
    event(PERMISSION.SALE_REOPEN_PAID, state(0, null), state(1, null), {
      actorId: SUPERVISOR_ID,
      reason: "wrong tender",
    }),
  );
  await audits.append(
    event(PERMISSION.SALE_EDIT_PRINTED_CHECK, state(0, null), state(1, null), {
      reason: "added dessert",
    }),
  );
  await audits.append(
    event(
      "pin.confirmation-failed",
      state(0, "after"),
      { ...state(1, "after"), pin: PIN_SECRET },
      { reason: "burned" },
    ),
  );
  await audits.append(
    voidAfter({
      reason: "rejected void",
      after: { ...state(1, "after"), approved: false },
    }),
  );
  await audits.append(
    event(
      PERMISSION.SALE_DISCOUNT,
      state(0, null),
      { ...state(10, null), approved: false },
      { actorId: CASHIER_ID, reason: "rejected discount" },
    ),
  );
  await audits.append(
    event(
      "cash.drawer-opened",
      state(0, null),
      { ...state(1, null), approved: false },
      { actorId: CASHIER_ID, reason: "rejected opening" },
    ),
  );
  await audits.append(
    event(
      PERMISSION.SALE_VOID_AFTER_KITCHEN,
      state(1, "after"),
      state(1, "after"),
      { reason: "same state" },
    ),
  );
  await audits.append(voidAfter({ kind: "altered", reason: "altered" }));
  await audits.append(
    voidAfter({ siteId: OTHER_SITE_ID, reason: "other site" }),
  );
  const { report, authorizations } = await openReport(audits);
  const recorded = await authorizations.eventsFor(TENANT_ID);
  const stored = await audits.list(TENANT_ID, null);

  const control = await report.execute({
    tenantId: TENANT_ID,
    sessionId: "session_owner",
    siteId: SITE_ID,
  });

  expect(ReadControlReportPort).toBe(ReadControlReport);
  expect(control).toEqual({
    voids: [
      {
        userId: WAITER_ID,
        authorizerId: SUPERVISOR_ID,
        reason: "burned",
        moment: "after kitchen",
      },
      {
        userId: WAITER_ID,
        authorizerId: SUPERVISOR_ID,
        reason: "wrong item",
        moment: "before kitchen",
      },
    ],
    discounts: [
      {
        userId: CASHIER_ID,
        authorizerId: SUPERVISOR_ID,
        value: 10,
      },
    ],
    courtesies: [
      {
        userId: WAITER_ID,
        authorizerId: SUPERVISOR_ID,
        value: 20_000,
      },
    ],
    cashDifferences: [
      {
        cashierId: CASHIER_ID,
        shiftId: CASH_SHIFT_ID,
      },
    ],
    drawerOpenings: [{ userId: CASHIER_ID }],
    reopenedOrEditedAfterPreBill: [
      { userId: SUPERVISOR_ID, kind: "reopened" },
      { userId: WAITER_ID, kind: "edited-after-pre-bill" },
    ],
  });
  expect(JSON.stringify(control)).not.toContain(PIN_SECRET);
  expect(await audits.list(TENANT_ID, null)).toEqual(stored);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
});

it("given a cashier without audit.view and a stored void, when they open the control report, then nothing is stored and no rows return", async () => {
  const audits = new InMemoryAuditRepository();
  await audits.append(voidAfter());
  const { report, authorizations } = await openReport(audits);
  const recorded = await authorizations.eventsFor(TENANT_ID);
  const stored = await audits.list(TENANT_ID, null);

  const control = await report.execute({
    tenantId: TENANT_ID,
    sessionId: "session_cashier",
    siteId: SITE_ID,
  });

  expect(control).toEqual(emptyReport());
  expect(await audits.list(TENANT_ID, null)).toEqual(stored);
  expect(await authorizations.eventsFor(TENANT_ID)).toEqual(recorded);
});
