import { expect, it } from "vitest";
import { PendingSalePrinter } from "#src/composition/sale-receipt.js";
import {
  OpenDrawerController,
  routePermissions,
} from "#src/http/open-drawer.controller.js";
import {
  absentRegisterId,
  cashPath,
  openCashActionCloud,
  openShiftId,
  postCash,
  printerId,
  reason,
  registerId,
  saveRegisters,
  silentRegisterId,
} from "#test/http/cash-action-cloud.js";
import { ownerId, tenantId } from "#test/http/dining-room-session.js";

const commandId = "command_drawer_1";
const drawerUrl = cashPath(`cash-registers/${registerId}/open-drawer`);

const command = {
  reason,
  shiftId: openShiftId,
  authorizationId: null,
  commandId,
};

const presentOffice = () =>
  saveRegisters([
    { id: registerId, drawer: "present", printerId },
    { id: absentRegisterId, drawer: "absent", printerId },
    { id: silentRegisterId, drawer: "present", printerId: null },
  ]);

it("given a kitchen chief session and a present drawer, when POST open-drawer is injected, then the response is 200 and nothing is printed or audited", async () => {
  const { application, audits } = await openCashActionCloud({
    organizations: await presentOffice(),
  });

  try {
    expect(routePermissions).toEqual({
      "POST cash-registers/:registerId/open-drawer": "cash.open-drawer",
    });
    expect(application.get(OpenDrawerController)).toBeInstanceOf(
      OpenDrawerController,
    );

    const response = await postCash(
      application,
      drawerUrl,
      "session_kitchen",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ registerId });
    expect(application.get(PendingSalePrinter).jobs).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, a present drawer, and a printer, when POST open-drawer is injected, then one drawer_open job is queued and the opening is audited", async () => {
  const { application, audits } = await openCashActionCloud({
    organizations: await presentOffice(),
  });

  try {
    const response = await postCash(
      application,
      drawerUrl,
      "session_owner",
      command,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ registerId });
    expect(application.get(PendingSalePrinter).jobs).toEqual([
      {
        commandId,
        printerId,
        document: "drawer_open",
        kickDrawer: true,
        status: "waiting",
      },
    ]);
    expect(await audits.list(tenantId, null)).toEqual([
      expect.objectContaining({
        action: "cash.drawer-opened",
        actorId: ownerId,
        authorizerId: null,
        deviceId: "",
        entity: registerId,
        reason,
        before: { value: 0 },
        after: { value: 1, shiftId: openShiftId, kitchen: null },
      }),
    ]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when the drawer is absent or the printer id is null, then nothing is queued or audited", async () => {
  const { application, audits } = await openCashActionCloud({
    organizations: await presentOffice(),
  });

  try {
    const absent = await postCash(
      application,
      cashPath(`cash-registers/${absentRegisterId}/open-drawer`),
      "session_owner",
      command,
    );
    const silent = await postCash(
      application,
      cashPath(`cash-registers/${silentRegisterId}/open-drawer`),
      "session_owner",
      command,
    );

    expect(absent.statusCode).toBe(200);
    expect(silent.statusCode).toBe(200);
    expect(application.get(PendingSalePrinter).jobs).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a present drawer, when POST open-drawer omits x-session-id, then the response is 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud({
    organizations: await presentOffice(),
  });

  try {
    const response = await postCash(application, drawerUrl, null, command);

    expect(response.statusCode).toBe(400);
    expect(application.get(PendingSalePrinter).jobs).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given a present drawer, when POST open-drawer sends an unknown session, then the response is 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud({
    organizations: await presentOffice(),
  });

  try {
    const response = await postCash(
      application,
      drawerUrl,
      "session_missing",
      command,
    );

    expect(response.statusCode).toBe(400);
    expect(application.get(PendingSalePrinter).jobs).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});

it("given an owner session, when POST open-drawer sends shift totals or an authorizer id, then the response is 400 and nothing is stored", async () => {
  const { application, audits } = await openCashActionCloud({
    organizations: await presentOffice(),
  });

  try {
    const response = await postCash(application, drawerUrl, "session_owner", {
      ...command,
      shiftTotals: { waiterVoidsBeforeKitchen: 1, compShiftCop: 0 },
      authorizerId: ownerId,
    });

    expect(response.statusCode).toBe(400);
    expect(application.get(PendingSalePrinter).jobs).toEqual([]);
    expect(await audits.list(tenantId, null)).toEqual([]);
  } finally {
    await application.close();
  }
});
