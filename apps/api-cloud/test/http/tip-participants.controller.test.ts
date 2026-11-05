import type { ClockEntry } from "@blackhole/attendance/application/ports/clock-entry-repository";
import { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import {
  TipRuleStore,
  TipSettlementStore,
} from "@blackhole/cash-register/application/entry-port";
import { expect, it } from "vitest";

import {
  cashPath,
  openCashActionCloud,
  postCash,
} from "#test/http/cash-action-cloud.js";
import { tenantId, venueId } from "#test/http/dining-room-session.js";

const from = "2026-03-04T13:00:00.000Z";
const to = "2026-03-04T22:00:00.000Z";
const settlementId = "settlement_shift";
const settleUrl = cashPath("tip-settlements");

const workers = [
  {
    userId: "employee_ana",
    workedMinutes: 60,
    out: "2026-03-04T14:00:00.000Z",
  },
  {
    userId: "employee_bea",
    workedMinutes: 120,
    out: "2026-03-04T15:00:00.000Z",
  },
  {
    userId: "employee_cio",
    workedMinutes: 180,
    out: "2026-03-04T16:00:00.000Z",
  },
  {
    userId: "employee_dio",
    workedMinutes: 240,
    out: "2026-03-04T17:00:00.000Z",
  },
] as const;

const proposed = workers.map((worker) => ({
  userId: worker.userId,
  workedMinutes: worker.workedMinutes,
}));

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

const settleBody = {
  reason: "Close the shift",
  settlementId,
  at: "2026-03-04T18:00:00.000Z",
  from,
  to,
  adds: [],
  removes: [],
  authorizationId: null,
};

const clockInShift = async (entries: ClockEntryRepository): Promise<void> => {
  for (const worker of workers) {
    await entries.append(
      clockEntry(`clock_${worker.userId}_in`, worker.userId, "clock_in", from),
    );
    await entries.append(
      clockEntry(
        `clock_${worker.userId}_out`,
        worker.userId,
        "clock_out",
        worker.out,
      ),
    );
  }
};

const prepareShift = async (
  application: Awaited<ReturnType<typeof openCashActionCloud>>["application"],
): Promise<void> => {
  await application.get(TipRuleStore).save(tenantId, venueId, {
    period: "shift",
    mode: "hours",
    shares: [],
  });
  await clockInShift(application.get(ClockEntryRepository));
};

it("given four workers clocked in during the shift, when settlement starts, then those four are proposed with their worked minutes", async () => {
  const { application } = await openCashActionCloud();

  try {
    await prepareShift(application);

    const response = await postCash(
      application,
      settleUrl,
      "session_owner",
      settleBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ participants: proposed });
    expect(
      await application.get(TipSettlementStore).list(tenantId, venueId),
    ).toEqual([
      expect.objectContaining({ id: settlementId, participants: proposed }),
    ]);
  } finally {
    await application.close();
  }
});

it("given four workers clocked in during the shift and a denied caller, when settlement starts, then nothing is written", async () => {
  const { application, audits } = await openCashActionCloud();

  try {
    await prepareShift(application);

    const response = await postCash(
      application,
      settleUrl,
      "session_kitchen",
      settleBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();
    expect(
      await application.get(TipSettlementStore).list(tenantId, venueId),
    ).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
