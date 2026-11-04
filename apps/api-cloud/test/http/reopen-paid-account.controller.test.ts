import { expect, it } from "vitest";
import {
  ReopenPaidAccountController,
  routePermissions,
} from "#src/http/reopen-paid-account.controller.js";
import {
  amountCop,
  cashPath,
  closedShiftId,
  openCashActionCloud,
  openingFloatCop,
  openShiftId,
  paidSale,
  paymentId,
  postCash,
  ReplacingCashRegisterRepository,
  reason,
  registerId,
  reversalId,
  SeededPaidAccount,
  saveRegisters,
  seedOpenShift,
} from "#test/http/cash-action-cloud.js";
import { ownerId, tenantId, venueId } from "#test/http/dining-room-session.js";

const reopenUrl = cashPath(
  `cash-registers/${registerId}/payments/${paymentId}/reopen`,
);

const command = {
  reason,
  authorizationId: null,
  reversalId,
};

const openOffice = () =>
  saveRegisters([{ id: registerId, drawer: "present", printerId: null }]);

it("given a kitchen chief session and an open shift, when POST reopen is injected, then the response is 200 and neither shift gains a reversal or an audit", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    paidAccounts: new SeededPaidAccount(paidSale),
  });

  try {
    expect(routePermissions).toEqual({
      "POST cash-registers/:registerId/payments/:paymentId/reopen":
        "sale.reopen-paid",
    });
    expect(application.get(ReopenPaidAccountController)).toBeInstanceOf(
      ReopenPaidAccountController,
    );

    const response = await postCash(
      application,
      reopenUrl,
      "session_kitchen",
      command,
    );
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ paymentId });
    expect(stored?.id).toBe(openShiftId);
    expect(stored?.state).toBe("open");
    expect(stored?.reversals).toEqual([]);
    expect(stored?.movements).toEqual([]);
    expect(closed.id).toBe(closedShiftId);
    expect(closed.reversals).toEqual([]);
    expect(closed.movements).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session and a different open shift, when POST reopen is injected, then the open shift stores the reversal and the audit", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    paidAccounts: new SeededPaidAccount(paidSale),
  });

  try {
    const response = await postCash(
      application,
      reopenUrl,
      "session_owner",
      command,
    );
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ paymentId });
    expect(stored?.reversals).toEqual([
      { id: reversalId, originalPaymentId: paymentId, amountCop },
    ]);
    expect(stored?.movements).toEqual([]);
    expect(stored?.payments).toEqual([]);
    expect(stored?.expectedCashCop).toBe(openingFloatCop);
    expect(stored?.id).toBe(openShiftId);
    expect(closed.reversals).toEqual([]);
    expect(closed.movements).toEqual([]);
    expect(closed.expectedCashCop).toBe(openingFloatCop);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.reopen-paid",
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        entity: paymentId,
        reason,
        before: { value: 0 },
        after: { value: amountCop, shiftId: openShiftId, kitchen: null },
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given an owner session and the default paid-account reader, when POST reopen is injected, then the open shift stays unchanged and nothing is audited", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
  });

  try {
    const response = await postCash(
      application,
      reopenUrl,
      "session_owner",
      command,
    );
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(200);
    expect(stored?.reversals).toEqual([]);
    expect(closed.reversals).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an open shift, when POST reopen omits x-session-id, then the response is 400 and nothing is stored", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    paidAccounts: new SeededPaidAccount(paidSale),
  });

  try {
    const response = await postCash(application, reopenUrl, null, command);
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(400);
    expect(stored?.reversals).toEqual([]);
    expect(closed.reversals).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an open shift, when POST reopen sends an unknown session, then the response is 400 and nothing is stored", async () => {
  const registers = new ReplacingCashRegisterRepository();
  await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    paidAccounts: new SeededPaidAccount(paidSale),
  });

  try {
    const response = await postCash(
      application,
      reopenUrl,
      "session_missing",
      command,
    );
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(400);
    expect(stored?.reversals).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST reopen sends shift totals or an authorizer id, then the response is 400 and nothing is stored", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    paidAccounts: new SeededPaidAccount(paidSale),
  });

  try {
    const response = await postCash(application, reopenUrl, "session_owner", {
      ...command,
      shiftTotals: { waiterVoidsBeforeKitchen: 1, compShiftCop: 0 },
      authorizerId: ownerId,
    });
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(400);
    expect(stored?.reversals).toEqual([]);
    expect(closed.reversals).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
