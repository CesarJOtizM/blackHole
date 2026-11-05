import type { ClockEntry } from "@blackhole/attendance/application/ports/clock-entry-repository";
import { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import {
  type RecordedPaymentTip,
  TipPool,
  TipRuleStore,
  TipSettlementStore,
} from "@blackhole/cash-register/application/entry-port";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it } from "vitest";

import {
  AdjustTipSettlementController,
  routePermissions as adjustRoutePermissions,
} from "#src/http/adjust-tip-settlement.controller.js";
import {
  SettleTipsController,
  routePermissions as settleRoutePermissions,
} from "#src/http/settle-tips.controller.js";
import {
  cashPath,
  openCashActionCloud,
  postCash,
} from "#test/http/cash-action-cloud.js";
import { ownerId, tenantId, venueId } from "#test/http/dining-room-session.js";

const cookId = "employee_cook";
const waiterId = "employee_waiter";
const hostId = "employee_host";
const settlementId = "settlement_day";
const adjustmentId = "settlement_day_adjustment";
const settleReason = "Close the day";
const adjustReason = "Correct the day";
const at = "2026-03-04T15:00:00.000Z";
const dayFrom = "2026-03-04T05:00:00.000Z";
const dayTo = "2026-03-05T05:00:00.000Z";
const settleUrl = cashPath("tip-settlements");
const adjustUrl = cashPath(`tip-settlements/${settlementId}/adjustments`);

const people = [
  { userId: cookId, workedMinutes: 360 },
  { userId: waiterId, workedMinutes: 480 },
];

const dayTips = (): RecordedPaymentTip[] => [
  {
    recordedAt: dayTo,
    tip: { method: "cash", amountCop: 40_000 },
    saleCop: 80_000,
    taxCop: 15_200,
  },
  {
    recordedAt: "2026-03-04T18:00:00.000Z",
    tip: { method: "cash", amountCop: 20_000 },
    saleCop: 10_000,
    taxCop: 1_900,
  },
  {
    recordedAt: "2026-03-04T20:00:00.000Z",
    tip: {
      method: "card",
      amountCop: 30_000,
      terminal: "terminal_1",
      approvalNumber: "approval_1",
      brand: "visa",
      last4: "4242",
    },
    saleCop: 120_000,
    taxCop: 22_800,
  },
];

const settleBody = {
  reason: settleReason,
  settlementId,
  at,
  from: dayFrom,
  to: dayTo,
  adds: [],
  removes: [],
  authorizationId: null,
};

const adjustBody = {
  reason: adjustReason,
  settlementId: adjustmentId,
  adds: [{ userId: hostId, workedMinutes: 0, reason: "Called in" }],
  removes: [],
  authorizationId: null,
};

const closedDay = {
  id: settlementId,
  poolCop: 50_000,
  methods: [
    { method: "cash", amountCop: 20_000 },
    { method: "card", amountCop: 30_000 },
  ],
  participants: people,
  shares: [
    { userId: cookId, baseCop: 25_000, residueCop: 0 },
    { userId: waiterId, baseCop: 25_000, residueCop: 0 },
  ],
  residueCop: 0,
  rule: { mode: "equal", shares: [] },
  adjustsSettlementId: null,
  edits: [],
};

const adjustedDay = {
  id: adjustmentId,
  poolCop: 50_000,
  methods: closedDay.methods,
  participants: [...people, { userId: hostId, workedMinutes: 0 }],
  shares: [
    { userId: cookId, baseCop: 16_666, residueCop: 1 },
    { userId: hostId, baseCop: 16_666, residueCop: 1 },
    { userId: waiterId, baseCop: 16_666, residueCop: 0 },
  ],
  residueCop: 0,
  rule: closedDay.rule,
  adjustsSettlementId: settlementId,
  edits: [
    {
      userId: hostId,
      workedMinutes: 0,
      reason: "Called in",
      change: "add",
    },
  ],
};

const storedSettlements = (application: NestFastifyApplication) =>
  application.get(TipSettlementStore).list(tenantId, venueId);

const prepareDay = async (application: NestFastifyApplication) => {
  await application.get(TipRuleStore).save(tenantId, venueId, {
    period: "day",
    mode: "equal",
    shares: [],
  });

  const pool = application.get(TipPool) as {
    record: (payment: RecordedPaymentTip) => void;
  };
  const entries = application.get(ClockEntryRepository);
  const clockIn = "2026-03-04T12:00:00.000Z";
  const shifts = [
    { userId: cookId, out: "2026-03-04T18:00:00.000Z" },
    { userId: waiterId, out: "2026-03-04T20:00:00.000Z" },
  ];

  for (const payment of dayTips()) {
    pool.record(payment);
  }

  for (const shift of shifts) {
    await entries.append(
      clockEntry(`clock_${shift.userId}_in`, shift.userId, "clock_in", clockIn),
    );
    await entries.append(
      clockEntry(
        `clock_${shift.userId}_out`,
        shift.userId,
        "clock_out",
        shift.out,
      ),
    );
  }
};

const clockEntry = (
  id: string,
  userId: string,
  kind: ClockEntry["kind"],
  occurredAt: string,
): ClockEntry => ({
  id,
  tenantId,
  venueId,
  userId,
  deviceId: "device_reader",
  kind,
  presence: "matched",
  occurredAt,
  commandId: id,
  cashRegisterId: null,
  pendingReview: false,
});

it("given a kitchen chief session, when settlement and adjustment are posted, then both responses are 200 null and nothing is stored or audited", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    expect(settleRoutePermissions).toEqual({
      "POST tip-settlements": "cash.settle-tips",
    });
    expect(adjustRoutePermissions).toEqual({
      "POST tip-settlements/:id/adjustments": "cash.settle-tips",
    });
    expect(application.get(SettleTipsController)).toBeInstanceOf(
      SettleTipsController,
    );
    expect(application.get(AdjustTipSettlementController)).toBeInstanceOf(
      AdjustTipSettlementController,
    );
    await prepareDay(application);

    const settled = await postCash(
      application,
      settleUrl,
      "session_kitchen",
      settleBody,
    );
    const adjusted = await postCash(
      application,
      adjustUrl,
      "session_kitchen",
      adjustBody,
    );

    expect(settled.statusCode).toBe(200);
    expect(settled.json()).toBeNull();
    expect(adjusted.statusCode).toBe(200);
    expect(adjusted.json()).toBeNull();
    expect(await storedSettlements(application)).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given seeded cash and card tips, when the owner posts the day settlement, then the pool is 50000 and only tips.settlement-closed is audited", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    await prepareDay(application);

    const response = await postCash(
      application,
      settleUrl,
      "session_owner",
      settleBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(closedDay);
    expect(JSON.stringify(response.json())).not.toContain("80000");
    expect(JSON.stringify(response.json())).not.toContain("15200");
    expect(JSON.stringify(response.json())).not.toContain("terminal_1");
    expect(await storedSettlements(application)).toEqual([closedDay]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "tips.settlement-closed",
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        entity: settlementId,
        reason: settleReason,
        before: null,
        after: closedDay,
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a closed settlement, when the owner posts an adjustment, then the new row id comes from the body and the path id is adjustsSettlementId", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    await prepareDay(application);
    await postCash(application, settleUrl, "session_owner", settleBody);

    const response = await postCash(
      application,
      adjustUrl,
      "session_owner",
      adjustBody,
    );

    expect(adjustmentId).not.toBe(settlementId);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(adjustedDay);
    expect(await storedSettlements(application)).toEqual([
      closedDay,
      adjustedDay,
    ]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({ action: "tips.settlement-closed" }),
      expect.objectContaining({
        action: "tips.settlement-adjusted",
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        siteId: venueId,
        entity: adjustmentId,
        reason: adjustReason,
        before: closedDay,
        after: adjustedDay,
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when a settlement body carries actor, session, or device fields, then both routes return 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    await prepareDay(application);
    const extra = {
      actorId: ownerId,
      sessionId: "session_owner",
      deviceId: "device_body",
    };
    const settled = await postCash(application, settleUrl, "session_owner", {
      ...settleBody,
      ...extra,
    });
    const adjusted = await postCash(application, adjustUrl, "session_owner", {
      ...adjustBody,
      ...extra,
    });

    expect(settled.statusCode).toBe(400);
    expect(adjusted.statusCode).toBe(400);
    expect(await storedSettlements(application)).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when a participant change reason is blank, then both routes return 400 and the blank change is not stored", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    await prepareDay(application);
    const settled = await postCash(application, settleUrl, "session_owner", {
      ...settleBody,
      adds: [{ userId: hostId, workedMinutes: 0, reason: " " }],
    });

    expect(settled.statusCode).toBe(400);
    expect(await storedSettlements(application)).toEqual([]);

    await postCash(application, settleUrl, "session_owner", settleBody);
    const adjusted = await postCash(application, adjustUrl, "session_owner", {
      ...adjustBody,
      adds: [],
      removes: [{ userId: cookId, reason: " " }],
    });

    expect(adjusted.statusCode).toBe(400);
    expect(await storedSettlements(application)).toEqual([closedDay]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({ action: "tips.settlement-closed" }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a settlement command, when the session is missing or unknown, then both routes return 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    const missingSettle = await postCash(
      application,
      settleUrl,
      null,
      settleBody,
    );
    const missingAdjust = await postCash(
      application,
      adjustUrl,
      null,
      adjustBody,
    );
    const unknownSettle = await postCash(
      application,
      settleUrl,
      "session_missing",
      settleBody,
    );
    const unknownAdjust = await postCash(
      application,
      adjustUrl,
      "session_missing",
      adjustBody,
    );

    expect(missingSettle.statusCode).toBe(400);
    expect(missingAdjust.statusCode).toBe(400);
    expect(unknownSettle.statusCode).toBe(400);
    expect(unknownAdjust.statusCode).toBe(400);
    expect(await storedSettlements(application)).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
