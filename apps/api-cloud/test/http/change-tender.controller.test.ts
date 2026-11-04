import { expect, it } from "vitest";
import {
  ChangeTenderController,
  routePermissions,
} from "#src/http/change-tender.controller.js";
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
  replacementId,
  reversalId,
  SeededOriginalPayment,
  saveRegisters,
  seedOpenShift,
} from "#test/http/cash-action-cloud.js";
import { ownerId, tenantId, venueId } from "#test/http/dining-room-session.js";

const tenderUrl = cashPath(
  `cash-registers/${registerId}/payments/${paymentId}/tender`,
);

const command = {
  reason,
  authorizationId: null,
  reversalId,
  replacementId,
  method: "card",
};

const openOffice = () =>
  saveRegisters([{ id: registerId, drawer: "present", printerId: null }]);

it("given a kitchen chief session and an open shift, when POST tender is injected, then the response is 200 and neither shift changes", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    originalPayments: new SeededOriginalPayment(paidSale),
  });

  try {
    expect(routePermissions).toEqual({
      "POST cash-registers/:registerId/payments/:paymentId/tender":
        "sale.change-tender",
    });
    expect(application.get(ChangeTenderController)).toBeInstanceOf(
      ChangeTenderController,
    );

    const response = await postCash(
      application,
      tenderUrl,
      "session_kitchen",
      command,
    );
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ paymentId, method: "card" });
    expect(stored?.id).toBe(openShiftId);
    expect(stored?.reversals).toEqual([]);
    expect(stored?.payments).toEqual([]);
    expect(stored?.movements).toEqual([]);
    expect(closed.id).toBe(closedShiftId);
    expect(closed.reversals).toEqual([]);
    expect(closed.payments).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session and a different open shift, when POST tender changes cash to card, then the open shift stores the reversal and the replacement", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    originalPayments: new SeededOriginalPayment(paidSale),
  });

  try {
    const response = await postCash(
      application,
      tenderUrl,
      "session_owner",
      command,
    );
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ paymentId, method: "card" });
    expect(stored?.reversals).toEqual([
      { id: reversalId, originalPaymentId: paymentId, amountCop },
    ]);
    expect(stored?.payments).toEqual([
      {
        id: replacementId,
        originalPaymentId: paymentId,
        method: "card",
        amountCop,
      },
    ]);
    expect(stored?.movements).toEqual([]);
    expect(stored?.expectedCashCop).toBe(openingFloatCop);
    expect(stored?.id).toBe(openShiftId);
    expect(closed.reversals).toEqual([]);
    expect(closed.payments).toEqual([]);
    expect(closed.movements).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "sale.change-tender",
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

it("given an owner session and the default original-payment reader, when POST tender is injected, then the open shift stays unchanged and nothing is audited", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
  });

  try {
    const response = await postCash(
      application,
      tenderUrl,
      "session_owner",
      command,
    );
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(200);
    expect(stored?.reversals).toEqual([]);
    expect(stored?.payments).toEqual([]);
    expect(closed.payments).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an open shift, when POST tender omits x-session-id, then the response is 400 and nothing is stored", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    originalPayments: new SeededOriginalPayment(paidSale),
  });

  try {
    const response = await postCash(application, tenderUrl, null, command);
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(400);
    expect(stored?.reversals).toEqual([]);
    expect(stored?.payments).toEqual([]);
    expect(closed.payments).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an open shift, when POST tender sends an unknown session, then the response is 400 and nothing is stored", async () => {
  const registers = new ReplacingCashRegisterRepository();
  await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    originalPayments: new SeededOriginalPayment(paidSale),
  });

  try {
    const response = await postCash(
      application,
      tenderUrl,
      "session_missing",
      command,
    );
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(400);
    expect(stored?.reversals).toEqual([]);
    expect(stored?.payments).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST tender sends shift totals or an authorizer id, then the response is 400 and nothing is stored", async () => {
  const registers = new ReplacingCashRegisterRepository();
  const closed = await seedOpenShift(registers, registerId);
  const { application, audits } = await openCashActionCloud({
    organizations: await openOffice(),
    registers,
    originalPayments: new SeededOriginalPayment(paidSale),
  });

  try {
    const response = await postCash(application, tenderUrl, "session_owner", {
      ...command,
      shiftTotals: { waiterVoidsBeforeKitchen: 1, compShiftCop: 0 },
      authorizerId: ownerId,
    });
    const stored = await registers.load(tenantId, venueId, registerId);

    expect(response.statusCode).toBe(400);
    expect(stored?.reversals).toEqual([]);
    expect(stored?.payments).toEqual([]);
    expect(closed.reversals).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
