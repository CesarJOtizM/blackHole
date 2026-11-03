import type { AuditEvent } from "@blackhole/platform/application/ports/audit-repository";
import { expect, it } from "vitest";

import {
  DetectUnusualBehaviorController,
  routePermissions,
} from "#src/http/detect-unusual-behavior.controller.js";
import {
  openDiningCloud,
  sessionHeader,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const SHIFT_ID = "shift_1";
const PIN_SECRET = "1357";
const SUPERVISOR_ID = "user_supervisor";
const behaviorUrl = `/tenants/${tenantId}/venues/${venueId}/unusual-behavior?shiftId=${SHIFT_ID}`;

const operation = (
  value: number,
  kitchen: "before" | "after",
  extra: Record<string, unknown> = {},
) => ({
  value,
  shiftId: SHIFT_ID,
  kitchen,
  ...extra,
});

const selfAuthorization = (): AuditEvent => ({
  tenantId,
  actorId: SUPERVISOR_ID,
  authorizerId: SUPERVISOR_ID,
  deviceId: "device_register",
  siteId: venueId,
  action: "sale.void-after-kitchen",
  entity: "check_self",
  before: operation(0, "after"),
  after: operation(1, "after", {
    selfAuthorized: true,
    pin: PIN_SECRET,
  }),
  reason: "sale.void-after-kitchen",
  occurredAt: 1_700_000_000_000,
  sequence: 1,
  previousHash: "0".repeat(64),
  digest: "ab".repeat(32),
  kind: "event",
});

const getBehavior = (
  application: Awaited<ReturnType<typeof openDiningCloud>>["application"],
  sessionId: string | null,
  url = behaviorUrl,
) =>
  application.inject({
    method: "GET",
    url,
    ...(sessionId === null ? {} : { headers: { [sessionHeader]: sessionId } }),
  });

it("given one self-authorization, when an owner GET unusual-behavior is injected, then that alert is returned without the PIN and the audit store stays", async () => {
  const { application, audits } = await openDiningCloud();
  await audits.append(selfAuthorization());
  const stored = await audits.list(tenantId, null);

  try {
    expect(routePermissions).toEqual({
      "GET unusual-behavior": "audit.view",
    });
    expect(application.get(DetectUnusualBehaviorController)).toBeInstanceOf(
      DetectUnusualBehaviorController,
    );

    const response = await getBehavior(application, "session_owner");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        kind: "self-authorization",
        actorId: SUPERVISOR_ID,
        shiftId: SHIFT_ID,
        action: "sale.void-after-kitchen",
        entity: "check_self",
      },
    ]);
    expect(JSON.stringify(response.json())).not.toContain(PIN_SECRET);
    expect(await audits.list(tenantId, null)).toEqual(stored);
  } finally {
    await application.close();
  }
});

it("given one self-authorization, when a kitchen chief GET unusual-behavior is injected, then the alert list is empty, the detector is not called, and the audit store stays", async () => {
  const { application, audits } = await openDiningCloud();
  await audits.append(selfAuthorization());
  const stored = await audits.list(tenantId, null);
  let listedDuringRead = 0;
  const readStored = audits.list.bind(audits);
  Object.assign(audits, {
    list: async (scopeTenantId: string, deviceId: string | null) => {
      listedDuringRead += 1;
      return readStored(scopeTenantId, deviceId);
    },
  });

  try {
    const response = await getBehavior(application, "session_kitchen");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    expect(listedDuringRead).toBe(0);
    expect(await readStored(tenantId, null)).toEqual(stored);
  } finally {
    await application.close();
  }
});

it("given one self-authorization, when the session is missing or unknown, shiftId is missing, or the query carries shiftTotals or authorizerId, then the response is 400 and the audit store stays", async () => {
  const { application, audits } = await openDiningCloud();
  await audits.append(selfAuthorization());
  const stored = await audits.list(tenantId, null);
  const base = `/tenants/${tenantId}/venues/${venueId}/unusual-behavior`;

  try {
    const missingSession = await getBehavior(application, null);
    const unknownSession = await getBehavior(application, "session_unknown");
    const missingShift = await getBehavior(application, "session_owner", base);
    const shiftTotals = await getBehavior(
      application,
      "session_owner",
      `${behaviorUrl}&shiftTotals=${encodeURIComponent('{"waiterVoidsBeforeKitchen":1}')}`,
    );
    const authorizer = await getBehavior(
      application,
      "session_owner",
      `${behaviorUrl}&authorizerId=${SUPERVISOR_ID}`,
    );

    expect(missingSession.statusCode).toBe(400);
    expect(unknownSession.statusCode).toBe(400);
    expect(missingShift.statusCode).toBe(400);
    expect(shiftTotals.statusCode).toBe(400);
    expect(authorizer.statusCode).toBe(400);
    expect(await audits.list(tenantId, null)).toEqual(stored);
  } finally {
    await application.close();
  }
});
