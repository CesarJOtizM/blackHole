import type { ClosedTipSettlement } from "@blackhole/cash-register/application/entry-port";
import { TipSettlementStore } from "@blackhole/cash-register/application/entry-port";
import {
  DispatchPrintJobs,
  EnqueuePrintJob,
  PrinterRepository,
  PrintJobRepository,
} from "@blackhole/printing/application/entry-port";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { expect, it, vi } from "vitest";

import {
  PrintTipSettlementController,
  routePermissions,
} from "#src/http/print-tip-settlement.controller.js";
import {
  cashPath,
  openCashActionCloud,
  postCash,
} from "#test/http/cash-action-cloud.js";
import { tenantId, venueId } from "#test/http/dining-room-session.js";

const settlementId = "settlement_day";
const printerId = "printer_register";
const commandId = "command_print_tips";
const period = "2026-03-04";
const printUrl = cashPath(`tip-settlements/${settlementId}/print`);

const printBody = {
  printerId,
  commandId,
  period,
};

const closedSettlement = (): ClosedTipSettlement => ({
  id: settlementId,
  poolCop: 10_000,
  methods: [
    { method: "cash", amountCop: 6_000 },
    { method: "card", amountCop: 4_000 },
  ],
  participants: [{ userId: "employee_cook", workedMinutes: 360 }],
  shares: [{ userId: "employee_cook", baseCop: 6_000, residueCop: 0 }],
  residueCop: 4_000,
  rule: {
    mode: "percentage",
    shares: [
      { employeeId: "employee_cook", percent: 60 },
      { employeeId: "employee_waiter", percent: 40 },
    ],
  },
  adjustsSettlementId: null,
  edits: [],
});

const queuedJobs = (application: NestFastifyApplication) =>
  (
    application.get(PrintJobRepository) as unknown as {
      rows: Array<{
        document: string;
        kickDrawer: boolean;
        status: string;
        pulse: Uint8Array | null;
      }>;
    }
  ).rows;

const watchPrint = (application: NestFastifyApplication) => ({
  enqueued: vi.spyOn(application.get(EnqueuePrintJob), "execute"),
  dispatched: vi.spyOn(application.get(DispatchPrintJobs), "execute"),
});

const preparePrint = async (application: NestFastifyApplication) => {
  await application.get(PrinterRepository).save({
    id: printerId,
    paper: "80",
  });
  await application
    .get(TipSettlementStore)
    .append(tenantId, venueId, closedSettlement());
};

it("given a kitchen chief and a closed settlement, when print is posted, then the queue stays empty and nothing is dispatched", async () => {
  const { application } = await openCashActionCloud();

  try {
    expect(routePermissions).toEqual({
      "POST tip-settlements/:id/print": "cash.settle-tips",
    });
    expect(application.get(PrintTipSettlementController)).toBeInstanceOf(
      PrintTipSettlementController,
    );
    await preparePrint(application);
    const { enqueued, dispatched } = watchPrint(application);

    const response = await postCash(
      application,
      printUrl,
      "session_kitchen",
      printBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toBeNull();
    expect(enqueued).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
    expect(queuedJobs(application)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner and a closed settlement, when print is posted, then one tips_settlement job with kickDrawer false is enqueued and then dispatched", async () => {
  const { application } = await openCashActionCloud();

  try {
    await preparePrint(application);
    const { enqueued, dispatched } = watchPrint(application);

    const response = await postCash(
      application,
      printUrl,
      "session_owner",
      printBody,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      settlementId,
      status: "queued",
      warning: "The print job stayed queued.",
    });
    expect(enqueued).toHaveBeenCalledTimes(1);
    expect(enqueued.mock.calls[0]?.[0]).toMatchObject({
      document: "tips_settlement",
      kickDrawer: false,
      printerId,
      commandId,
      period,
    });
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(enqueued.mock.invocationCallOrder[0]).toBeLessThan(
      dispatched.mock.invocationCallOrder[0] ?? 0,
    );
    expect(queuedJobs(application)).toEqual([
      expect.objectContaining({
        document: "tips_settlement",
        kickDrawer: false,
        status: "printed",
        pulse: null,
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given a body that carries the session actor or device, when print is posted, then the request is rejected and the queue stays empty", async () => {
  const { application } = await openCashActionCloud();

  try {
    await preparePrint(application);
    const { enqueued, dispatched } = watchPrint(application);

    const response = await postCash(application, printUrl, "session_owner", {
      ...printBody,
      actorId: "user_owner",
      sessionId: "session_owner",
      deviceId: "device_owner",
    });

    expect(response.statusCode).toBe(400);
    expect(enqueued).not.toHaveBeenCalled();
    expect(dispatched).not.toHaveBeenCalled();
    expect(queuedJobs(application)).toEqual([]);
  } finally {
    await application.close();
  }
});
