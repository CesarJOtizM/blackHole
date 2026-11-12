import { expect, it } from "vitest";

import {
  AuthorizeReport,
  type ReportCommand,
} from "#application/authorize-report/authorize-report.js";
import {
  type OpenShiftBounds,
  REPORT_PERMISSION,
  type ReportAccess,
} from "#application/ports/report-access.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const ACTOR_ID = "identity_user_1";
const WAITER_ID = "identity_waiter_1";
const OTHER_WAITER_ID = "identity_waiter_2";
const OPEN_SHIFT_ID = "shift_open";
const PREVIOUS_SHIFT_ID = "shift_previous";
const FROM = "2026-11-11T05:00:00.000Z";
const TO = "2026-11-12T05:00:00.000Z";
const OPENED_AT = "2026-11-11T16:00:00.000Z";
const CLOSED_AT = "2026-11-11T22:00:00.000Z";

const access = (allowed: boolean): ReportAccess => ({
  allows: async (input) => {
    expect(input.permission).toBe(REPORT_PERMISSION.VIEW_SALES);
    return allowed;
  },
});

const shifts = (
  open: {
    shiftId: string;
    openedAt: string;
    closedAt: string | null;
  } | null,
): OpenShiftBounds => ({
  findOpen: async () => open,
});

const command = (overrides: Partial<ReportCommand> = {}): ReportCommand => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  actorId: ACTOR_ID,
  role: "site_administrator",
  homeVenueId: VENUE_ID,
  waiterId: null,
  subjectWaiterId: null,
  shiftId: null,
  from: FROM,
  to: TO,
  ...overrides,
});

const authorize = (allowed: boolean, open: Parameters<typeof shifts>[0]) =>
  new AuthorizeReport(access(allowed), shifts(open));

it("given an administrator of another venue, when they request this venue, then access is denied", async () => {
  const decision = await authorize(true, null).execute(
    command({ homeVenueId: OTHER_VENUE_ID }),
  );

  expect(decision).toEqual({ outcome: "denied", reason: "other_venue" });
});

it("given a reader without report.view-sales, when they request a report, then access is denied", async () => {
  const decision = await authorize(false, null).execute(command());

  expect(decision).toEqual({
    outcome: "denied",
    reason: "missing_permission",
  });
});

it("given a waiter, when they request another waiter, then access is denied", async () => {
  const decision = await authorize(true, null).execute(
    command({
      role: "waiter",
      waiterId: WAITER_ID,
      subjectWaiterId: OTHER_WAITER_ID,
    }),
  );

  expect(decision).toEqual({ outcome: "denied", reason: "other_waiter" });
});

it("given a supervisor, when they open a previous shift, then access is denied", async () => {
  const decision = await authorize(true, {
    shiftId: OPEN_SHIFT_ID,
    openedAt: OPENED_AT,
    closedAt: null,
  }).execute(
    command({
      role: "supervisor",
      shiftId: PREVIOUS_SHIFT_ID,
    }),
  );

  expect(decision).toEqual({ outcome: "denied", reason: "previous_shift" });
});

it("given a supervisor of the open shift, when the request starts earlier, then the period is clamped to the shift", async () => {
  const decision = await authorize(true, {
    shiftId: OPEN_SHIFT_ID,
    openedAt: OPENED_AT,
    closedAt: CLOSED_AT,
  }).execute(
    command({
      role: "supervisor",
      shiftId: OPEN_SHIFT_ID,
    }),
  );

  expect(decision).toEqual({
    outcome: "allowed",
    venueId: VENUE_ID,
    from: OPENED_AT,
    to: CLOSED_AT,
    waiterId: null,
  });
});

it("given a site administrator with report.view-sales, when they request their venue, then the period stays unchanged", async () => {
  const decision = await authorize(true, null).execute(command());

  expect(decision).toEqual({
    outcome: "allowed",
    venueId: VENUE_ID,
    from: FROM,
    to: TO,
    waiterId: null,
  });
});
