import type { AuditEvent } from "@blackhole/platform/application/ports/audit-repository";
import { expect, it } from "vitest";

import {
  ReadControlReportController,
  routePermissions,
} from "#src/http/read-control-report.controller.js";
import {
  openDiningCloud,
  sessionHeader,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const SHIFT_ID = "shift_1";
const reportUrl = `/tenants/${tenantId}/venues/${venueId}/control-report`;

const operation = (value: number) => ({
  value,
  shiftId: SHIFT_ID,
  kitchen: "before" as const,
});

const beforeKitchenVoid = (): AuditEvent => ({
  tenantId,
  actorId: "user_waiter",
  authorizerId: null,
  deviceId: "device_register",
  siteId: venueId,
  action: "sale.void-before-kitchen",
  entity: "check_void",
  before: operation(0),
  after: operation(1),
  reason: "wrong item",
  occurredAt: 1_700_000_000_000,
  sequence: 1,
  previousHash: "0".repeat(64),
  digest: "ab".repeat(32),
  kind: "event",
});

const emptyReport = {
  voids: [],
  discounts: [],
  courtesies: [],
  cashDifferences: [],
  drawerOpenings: [],
  reopenedOrEditedAfterPreBill: [],
};

const getReport = (
  application: Awaited<ReturnType<typeof openDiningCloud>>["application"],
  sessionId: string | null,
) =>
  application.inject({
    method: "GET",
    url: reportUrl,
    ...(sessionId === null ? {} : { headers: { [sessionHeader]: sessionId } }),
  });

it("given a successful sale.void-before-kitchen audit, when an owner GET control-report is injected, then that void row is returned and the audit list length stays", async () => {
  const { application, audits } = await openDiningCloud();
  await audits.append(beforeKitchenVoid());
  const stored = await audits.list(tenantId, null);

  try {
    expect(routePermissions).toEqual({
      "GET control-report": "audit.view",
    });
    expect(application.get(ReadControlReportController)).toBeInstanceOf(
      ReadControlReportController,
    );

    const response = await getReport(application, "session_owner");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ...emptyReport,
      voids: [
        {
          userId: "user_waiter",
          authorizerId: null,
          reason: "wrong item",
          moment: "before kitchen",
        },
      ],
    });
    expect(await audits.list(tenantId, null)).toEqual(stored);
  } finally {
    await application.close();
  }
});

it("given a successful sale.void-before-kitchen audit, when a kitchen chief GET control-report is injected, then every section is empty and the audit list length stays", async () => {
  const { application, audits } = await openDiningCloud();
  await audits.append(beforeKitchenVoid());
  const stored = await audits.list(tenantId, null);

  try {
    const response = await getReport(application, "session_kitchen");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(emptyReport);
    expect(await audits.list(tenantId, null)).toEqual(stored);
  } finally {
    await application.close();
  }
});

it("given a stored before-kitchen void, when GET control-report has no session or an unknown session, then the response is 400 and the audit list length stays", async () => {
  const { application, audits } = await openDiningCloud();
  await audits.append(beforeKitchenVoid());
  const stored = await audits.list(tenantId, null);

  try {
    const missing = await getReport(application, null);
    const unknown = await getReport(application, "session_unknown");

    expect(missing.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(400);
    expect(await audits.list(tenantId, null)).toEqual(stored);
  } finally {
    await application.close();
  }
});
