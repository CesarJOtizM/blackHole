import { TipRuleStore } from "@blackhole/cash-register/application/entry-port";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it } from "vitest";

import {
  ConfigureTipRuleController,
  routePermissions,
} from "#src/http/configure-tip-rule.controller.js";
import {
  cashPath,
  kitchenChiefId,
  openCashActionCloud,
} from "#test/http/cash-action-cloud.js";
import {
  ownerId,
  sessionHeader,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const ruleReason = "Weekly split";
const tipRuleUrl = cashPath("tip-rule");

const percentageRule = {
  reason: ruleReason,
  period: "day",
  mode: "percentage",
  shares: [
    { employeeId: ownerId, percent: 70 },
    { employeeId: kitchenChiefId, percent: 30 },
  ],
  authorizationId: null,
};

const savedRule = {
  period: "day",
  mode: "percentage",
  shares: percentageRule.shares,
};

const putTipRule = (
  application: NestFastifyApplication,
  sessionId: string | null,
  payload: unknown,
): Promise<{ statusCode: number; json: () => unknown }> =>
  application.inject({
    method: "PUT",
    url: tipRuleUrl,
    ...(sessionId === null ? {} : { headers: { [sessionHeader]: sessionId } }),
    payload: payload as Record<string, unknown>,
  });

const storedRule = (application: NestFastifyApplication) =>
  application.get(TipRuleStore).find(tenantId, venueId);

it("given a kitchen chief session, when PUT tip-rule is injected, then the response is 200 and nothing is stored or audited", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    expect(routePermissions).toEqual({
      "PUT tip-rule": "cash.settle-tips",
    });
    expect(application.get(ConfigureTipRuleController)).toBeInstanceOf(
      ConfigureTipRuleController,
    );

    const response = await putTipRule(
      application,
      "session_kitchen",
      percentageRule,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();
    expect(await storedRule(application)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when PUT tip-rule sends a percentage split, then the rule is stored and only tips.rule-changed is audited", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    const response = await putTipRule(
      application,
      "session_owner",
      percentageRule,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(savedRule);
    expect(await storedRule(application)).toEqual(savedRule);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "tips.rule-changed",
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        entity: venueId,
        reason: ruleReason,
        before: null,
        after: savedRule,
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a tip rule, when PUT tip-rule omits x-session-id, then the response is 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    const response = await putTipRule(application, null, percentageRule);

    expect(response.statusCode).toBe(400);
    expect(await storedRule(application)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a tip rule, when PUT tip-rule sends an unknown session, then the response is 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    const response = await putTipRule(
      application,
      "session_missing",
      percentageRule,
    );

    expect(response.statusCode).toBe(400);
    expect(await storedRule(application)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when PUT tip-rule sends actor, session, or device fields, then the response is 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    const response = await putTipRule(application, "session_owner", {
      ...percentageRule,
      actorId: ownerId,
      sessionId: "session_owner",
      deviceId: "device_body",
    });

    expect(response.statusCode).toBe(400);
    expect(await storedRule(application)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when PUT tip-rule sends shares for an equal rule, then the response is 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    const response = await putTipRule(application, "session_owner", {
      reason: ruleReason,
      period: "week",
      mode: "equal",
      shares: [{ employeeId: ownerId, percent: 100 }],
      authorizationId: null,
    });

    expect(response.statusCode).toBe(400);
    expect(await storedRule(application)).toBeNull();
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
