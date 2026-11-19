import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { Check, DiningTable } from "@blackhole/orders/domain";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import { Authorization, Identity } from "@blackhole/platform/domain";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  NoRestockController,
  routePermissions,
} from "#src/http/no-restock.controller.js";
import {
  checkId,
  diningPath,
  getDining,
  openDiningCloud,
  postDining,
  sessionHeader,
  tableId,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

const productId = "menu_product_ribs";
const openedAt = "2026-10-28T12:00:00.000Z";
const chiefId = "user_kitchen";
const waiterId = "user_waiter";
const chiefSession = "session_kitchen";
const waiterSession = "session_waiter";
const sentLineId = "line_ribs";
const startedLineId = "line_ribs_started";
const deliveredLineId = "line_ribs_done";
const startedTableId = "table_7";
const deliveredTableId = "table_9";
const startedCheckId = "check_7";
const deliveredCheckId = "check_9";

const clients: PGlite[] = [];

const migration = (name: string): string =>
  readFileSync(
    fileURLToPath(
      new URL(
        `../../../../contexts/inventory/adapters/postgres/${name}`,
        import.meta.url,
      ),
    ),
    "utf8",
  );

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const openDatabase = async (): Promise<PGlite> => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration("0001_recipe_catalog.sql"));
  await client.exec(migration("0007_no_restock_today.sql"));

  return client;
};

const proposeRibs = async (client: PGlite): Promise<void> => {
  await client.exec(`
    BEGIN;
    SET LOCAL ROLE inventory_app;
    SELECT set_config('app.tenant_id', '${tenantId}', true);
    INSERT INTO no_restock_today (
      tenant_id, venue_id, product_id, status, actor_id, service_date
    ) VALUES (
      '${tenantId}', '${venueId}', '${productId}', 'proposed', NULL, NULL
    );
    COMMIT;
  `);
};

const seatSentRibs = async (
  diningRooms: InMemoryDiningRoomRepository,
): Promise<void> => {
  const table = DiningTable.place({
    id: tableId,
    tenantId,
    venueId,
    zone: "Terrace",
  });
  table.open({ diners: 4 });
  await diningRooms.save(table);

  const check = Check.open({
    id: checkId,
    tenantId,
    venueId,
    tableId,
    openedAt,
  });
  check.addLine({
    orderId: "order_ribs",
    lineId: sentLineId,
    productId,
    name: "Costilla",
    course: 1,
    price: 42_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: openedAt });
  await diningRooms.saveCheck(check);
};

const seatAdvancedRibs = async (
  diningRooms: InMemoryDiningRoomRepository,
  input: {
    table: string;
    check: string;
    lineId: string;
    state: "in_preparation" | "delivered";
  },
): Promise<void> => {
  const table = DiningTable.place({
    id: input.table,
    tenantId,
    venueId,
    zone: "Terrace",
  });
  table.open({ diners: 2 });
  await diningRooms.save(table);

  const check = Check.open({
    id: input.check,
    tenantId,
    venueId,
    tableId: input.table,
    openedAt,
  });
  check.addLine({
    orderId: `order_${input.check}`,
    lineId: input.lineId,
    productId,
    name: "Costilla",
    course: 1,
    price: 42_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: openedAt });
  check.advance({
    lineId: input.lineId,
    state: "in_preparation",
    at: openedAt,
  });

  if (input.state === "delivered") {
    check.advance({ lineId: input.lineId, state: "ready", at: openedAt });
    check.advance({ lineId: input.lineId, state: "delivered", at: openedAt });
  }

  await diningRooms.saveCheck(check);
};

const lineState = async (
  diningRooms: InMemoryDiningRoomRepository,
  id: string,
  lineId: string,
): Promise<string | undefined> => {
  const check = await diningRooms.loadCheck(tenantId, venueId, id);

  return check?.orders
    .flatMap((order) => order.lines)
    .find((line) => line.id === lineId)?.state;
};

const openCloud = async (enabled: boolean) => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const diningRooms = new InMemoryDiningRoomRepository();
  const audits = new InMemoryAuditRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);
  const clock = new FakeClock(Date.parse(openedAt));
  const people = [
    [chiefId, chiefSession, "kitchenChief"],
    [waiterId, waiterSession, "waiter"],
  ] as const;

  for (const [userId, sessionId] of people) {
    identity.registerUser({
      id: userId,
      displayName: userId,
      passwordHash: await passwords.hash("secret"),
      pinHash: `pin-hash:${userId}`,
    });
    identity.signInAdministration({
      userId,
      passwordHash: await passwords.hash("secret"),
      factorHash: null,
      sessionId,
    });
  }

  const signedIn = identity.snapshot();
  await identities.save(identity, { before: signedIn, after: signedIn });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: people.map(([userId, , roleId]) => ({
      id: `assignment_${roleId}`,
      userId,
      roleId,
      scopeKind: "company" as const,
      scopeId: tenantId,
      validFrom: null,
      validUntil: null,
    })),
    venueLimits: [],
    bartenderCharge: [],
    requests: [],
    resolutions: [],
    supportGrants: [],
    supportActions: [],
    shiftFlags: [],
    notices: [],
  });
  await authorizations.save(authorization, {
    before: Authorization.open(tenantId).snapshot(),
    after: authorization.snapshot(),
  });

  const inventoryDatabase = enabled ? await openDatabase() : undefined;
  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    authorizations,
    audits,
    diningRooms,
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
    ...(inventoryDatabase === undefined ? {} : { inventoryDatabase }),
    ...(enabled ? { noRestockTodayEnabled: true } : {}),
  });

  return { application, diningRooms, audits, inventoryDatabase };
};

it("given the flag is off, when no-restock is listed, then the route is absent", async () => {
  const { application } = await openDiningCloud();

  try {
    expect(routePermissions).toEqual({
      "GET no-restock": "session",
      "POST products/:productId/no-restock/confirm":
        "inventory.confirm-no-restock",
      "POST products/:productId/no-restock/remove":
        "inventory.remove-no-restock",
      "POST checks/:checkId/lines/:lineId/guest-told": "session",
      "POST checks/:checkId/lines/:lineId/cannot-finish": "session",
    });
    expect(() => application.get(NoRestockController)).toThrow();

    const response = await application.inject({
      method: "GET",
      url: diningPath("no-restock"),
      headers: { [sessionHeader]: chiefSession },
    });

    expect(response.statusCode).toBe(404);
  } finally {
    await application.close();
  }
});

it("given a waiter session, when the waiter confirms or removes the mark, then the response is 403", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    if (inventoryDatabase === undefined) {
      throw new Error("PostgreSQL is required.");
    }

    await proposeRibs(inventoryDatabase);
    const confirm = await postDining(
      application,
      diningPath(`products/${productId}/no-restock/confirm`),
      waiterSession,
      {},
    );
    const remove = await postDining(
      application,
      diningPath(`products/${productId}/no-restock/remove`),
      waiterSession,
      {},
    );

    expect(confirm.statusCode).toBe(403);
    expect(remove.statusCode).toBe(403);
    expect(confirm.json()).toEqual({ error: "NoRestockNotPermitted" });
  } finally {
    await application.close();
  }
});

it("given a proposed mark and a sent line, when the kitchen chief confirms, then the line is withdrawn and the audit names the table", async () => {
  const { application, diningRooms, audits, inventoryDatabase } =
    await openCloud(true);

  try {
    if (inventoryDatabase === undefined) {
      throw new Error("PostgreSQL is required.");
    }

    await proposeRibs(inventoryDatabase);
    await seatSentRibs(diningRooms);
    const response = await postDining(
      application,
      diningPath(`products/${productId}/no-restock/confirm`),
      chiefSession,
      {},
    );
    const listed = await getDining(
      application,
      diningPath("no-restock"),
      chiefSession,
    );
    const events = await audits.list(tenantId, null);
    const confirmation = events.find(
      (event) => event.action === "inventory.confirm-no-restock",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      productId,
      status: "confirmed",
      serviceDate: "2026-10-28",
      tables: [tableId],
    });
    expect(await lineState(diningRooms, checkId, sentLineId)).toBe(
      "not_delivered",
    );
    expect(confirmation?.after).toMatchObject({ tables: [tableId] });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      marks: [
        {
          productId,
          status: "confirmed",
          serviceDate: "2026-10-28",
          actorId: chiefId,
        },
      ],
      notices: [
        {
          checkId,
          tableId,
          lineId: sentLineId,
          productId,
        },
      ],
    });
  } finally {
    await application.close();
  }
});

it("given a confirmed mark, when the kitchen chief removes it, then the list reads removed", async () => {
  const { application, inventoryDatabase } = await openCloud(true);

  try {
    if (inventoryDatabase === undefined) {
      throw new Error("PostgreSQL is required.");
    }

    await proposeRibs(inventoryDatabase);
    await postDining(
      application,
      diningPath(`products/${productId}/no-restock/confirm`),
      chiefSession,
      {},
    );
    const response = await postDining(
      application,
      diningPath(`products/${productId}/no-restock/remove`),
      chiefSession,
      {},
    );
    const listed = await getDining(
      application,
      diningPath("no-restock"),
      chiefSession,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      productId,
      status: "removed",
    });
    expect(listed.json()).toMatchObject({
      marks: [{ productId, status: "removed" }],
    });
  } finally {
    await application.close();
  }
});

it("given a started line the station cannot finish, when the waiter tells the guest, then the notice leaves the list", async () => {
  const { application, diningRooms } = await openCloud(true);

  try {
    await seatAdvancedRibs(diningRooms, {
      table: startedTableId,
      check: startedCheckId,
      lineId: startedLineId,
      state: "in_preparation",
    });
    const finished = await postDining(
      application,
      diningPath(
        `checks/${startedCheckId}/lines/${startedLineId}/cannot-finish`,
      ),
      chiefSession,
      {},
    );
    const pending = await getDining(
      application,
      diningPath("no-restock"),
      waiterSession,
    );
    const told = await postDining(
      application,
      diningPath(`checks/${startedCheckId}/lines/${startedLineId}/guest-told`),
      waiterSession,
      {},
    );
    const after = await getDining(
      application,
      diningPath("no-restock"),
      waiterSession,
    );

    expect(finished.statusCode).toBe(200);
    expect(finished.json()).toEqual({
      checkId: startedCheckId,
      lineId: startedLineId,
      state: "not_delivered",
    });
    expect(await lineState(diningRooms, startedCheckId, startedLineId)).toBe(
      "not_delivered",
    );
    expect(pending.json()).toMatchObject({
      notices: [
        {
          checkId: startedCheckId,
          tableId: startedTableId,
          lineId: startedLineId,
          productId,
        },
      ],
    });
    expect(told.statusCode).toBe(200);
    expect(told.json()).toEqual({
      checkId: startedCheckId,
      lineId: startedLineId,
      actorId: waiterId,
    });
    expect(after.json()).toMatchObject({ notices: [] });
  } finally {
    await application.close();
  }
});

it("given a delivered line, when the station cannot finish it, then the line stays delivered", async () => {
  const { application, diningRooms } = await openCloud(true);

  try {
    await seatAdvancedRibs(diningRooms, {
      table: deliveredTableId,
      check: deliveredCheckId,
      lineId: deliveredLineId,
      state: "delivered",
    });
    const response = await postDining(
      application,
      diningPath(
        `checks/${deliveredCheckId}/lines/${deliveredLineId}/cannot-finish`,
      ),
      chiefSession,
      {},
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "UndeliverableLineRejected" });
    expect(
      await lineState(diningRooms, deliveredCheckId, deliveredLineId),
    ).toBe("delivered");
  } finally {
    await application.close();
  }
});
