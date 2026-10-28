import { expect, it } from "vitest";

import type { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { Check } from "#domain/check.js";
import { DiningTable } from "#domain/dining-table.js";

const TENANT_A = "organization_tenant_a";
const TENANT_B = "organization_tenant_b";
const VENUE_ID = "organization_venue_1";
const OTHER_VENUE_ID = "organization_venue_2";
const TABLE_ID = "table_5";
const CHECK_ID = "check_5";
const OTHER_CHECK_ID = "check_6";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:03:10.000Z";
const PREPARED_AT = "2026-10-28T12:04:00.000Z";
const READY_AT = "2026-10-28T12:06:00.000Z";

const occupiedTable = (tenantId: string, venueId = VENUE_ID): DiningTable => {
  const table = DiningTable.place({
    id: TABLE_ID,
    tenantId,
    venueId,
    zone: "Terrace",
  });

  table.open({ diners: 4 });

  return table;
};

const servedCheck = (tenantId: string, venueId = VENUE_ID): Check => {
  const check = Check.open({
    id: CHECK_ID,
    tenantId,
    venueId,
    tableId: TABLE_ID,
    openedAt: OPENED_AT,
  });

  check.addLine({
    orderId: "order_1",
    lineId: "line_soup",
    productId: "menu_soup",
    name: "Jalapeño soup",
    course: 1,
    price: 12_000,
    channel: "waiter",
    variantIds: ["menu_variant_cup"],
    modifierIds: ["menu_modifier_cream"],
    note: "no onion",
  });
  check.addLine({
    orderId: "order_1",
    lineId: "line_steak",
    productId: "menu_steak",
    name: "Steak",
    course: 2,
    price: 45_000,
    channel: "waiter",
  });
  check.send({ course: 1, sentAt: SENT_AT });
  check.advance({
    lineId: "line_soup",
    state: "in_preparation",
    at: PREPARED_AT,
  });
  check.advance({
    lineId: "line_soup",
    state: "ready",
    at: READY_AT,
  });
  check.requestCheck({ requestedAt: READY_AT });

  return check;
};

const tableCopy = (table: DiningTable) => ({
  id: table.id,
  tenantId: table.tenantId,
  venueId: table.venueId,
  zone: table.zone,
  state: table.state,
  diners: table.diners,
});

const checkCopy = (check: Check) => ({
  id: check.id,
  tenantId: check.tenantId,
  venueId: check.venueId,
  tableId: check.tableId,
  openedAt: check.openedAt,
  firstSentAt: check.firstSentAt,
  tableState: check.tableState,
  preBillRequest: check.preBillRequest,
  orderTakingSeconds: check.orderTakingSeconds,
  total: check.total,
  orders: check.orders,
  readyNotices: check.readyNotices,
});

const requireTable = (table: DiningTable | null): DiningTable => {
  if (table === null) {
    throw new Error("Expected a table.");
  }

  return table;
};

const requireCheck = (check: Check | null): Check => {
  if (check === null) {
    throw new Error("Expected a check.");
  }

  return check;
};

export function diningRoomRepositoryContract(
  createRepository: () => DiningRoomRepository | Promise<DiningRoomRepository>,
): void {
  it("given a saved table, check, and lines, when they are loaded, then the copy matches", async () => {
    const repository = await createRepository();
    const table = occupiedTable(TENANT_A);
    const check = servedCheck(TENANT_A);
    const savedTable = tableCopy(table);
    const savedCheck = checkCopy(check);

    await repository.save(table);
    await repository.saveCheck(check);

    const loadedTable = requireTable(
      await repository.load(TENANT_A, VENUE_ID, TABLE_ID),
    );
    const loadedCheck = requireCheck(
      await repository.loadCheck(TENANT_A, VENUE_ID, CHECK_ID),
    );
    expect(loadedTable).toBeInstanceOf(DiningTable);
    expect(loadedTable).not.toBe(table);
    expect(tableCopy(loadedTable)).toEqual(savedTable);
    expect(
      (await repository.listTables(TENANT_A, VENUE_ID)).map(tableCopy),
    ).toEqual([savedTable]);
    expect(loadedCheck).toBeInstanceOf(Check);
    expect(loadedCheck).not.toBe(check);
    expect(checkCopy(loadedCheck)).toEqual(savedCheck);
    expect(savedCheck.total).toBe(12_000);
    expect(
      (await repository.listChecks(TENANT_A, VENUE_ID)).map(checkCopy),
    ).toEqual([savedCheck]);

    table.release();
    loadedCheck.addLine({
      orderId: "order_1",
      lineId: "line_extra",
      productId: "menu_bread",
      name: "Bread",
      course: 1,
      price: 4_000,
      channel: "waiter",
    });

    expect(
      tableCopy(
        requireTable(await repository.load(TENANT_A, VENUE_ID, TABLE_ID)),
      ),
    ).toEqual(savedTable);
    expect(
      checkCopy(
        requireCheck(await repository.loadCheck(TENANT_A, VENUE_ID, CHECK_ID)),
      ),
    ).toEqual(savedCheck);
  });

  it("given two checks, when they are saved together, then both copies load", async () => {
    const repository = await createRepository();
    const first = servedCheck(TENANT_A);
    const second = Check.open({
      id: OTHER_CHECK_ID,
      tenantId: TENANT_A,
      venueId: VENUE_ID,
      tableId: "table_6",
      openedAt: OPENED_AT,
    });

    await repository.saveChecks([first, second]);

    expect(
      checkCopy(
        requireCheck(await repository.loadCheck(TENANT_A, VENUE_ID, CHECK_ID)),
      ),
    ).toEqual(checkCopy(first));
    expect(
      checkCopy(
        requireCheck(
          await repository.loadCheck(TENANT_A, VENUE_ID, OTHER_CHECK_ID),
        ),
      ),
    ).toEqual(checkCopy(second));
  });

  it("given tenant B saved a table and a check, when tenant A loads them, then B stays hidden", async () => {
    const repository = await createRepository();

    await repository.save(occupiedTable(TENANT_A));
    await repository.save(occupiedTable(TENANT_B));
    await repository.save(occupiedTable(TENANT_A, OTHER_VENUE_ID));
    await repository.saveCheck(servedCheck(TENANT_A));
    await repository.saveCheck(servedCheck(TENANT_B));
    await repository.saveCheck(servedCheck(TENANT_A, OTHER_VENUE_ID));

    const tables = await repository.listTables(TENANT_A, VENUE_ID);
    const checks = await repository.listChecks(TENANT_A, VENUE_ID);
    expect(tables.map((table) => table.tenantId)).toEqual([TENANT_A]);
    expect(tables.map((table) => table.venueId)).toEqual([VENUE_ID]);
    expect(
      requireTable(await repository.load(TENANT_A, VENUE_ID, TABLE_ID))
        .tenantId,
    ).toBe(TENANT_A);
    expect(
      requireTable(await repository.load(TENANT_B, VENUE_ID, TABLE_ID))
        .tenantId,
    ).toBe(TENANT_B);
    expect(
      requireTable(await repository.load(TENANT_A, OTHER_VENUE_ID, TABLE_ID))
        .venueId,
    ).toBe(OTHER_VENUE_ID);
    expect(checks.map((check) => check.tenantId)).toEqual([TENANT_A]);
    expect(checks.map((check) => check.venueId)).toEqual([VENUE_ID]);
    expect(
      requireCheck(await repository.loadCheck(TENANT_A, VENUE_ID, CHECK_ID))
        .tenantId,
    ).toBe(TENANT_A);
    expect(
      requireCheck(await repository.loadCheck(TENANT_B, VENUE_ID, CHECK_ID))
        .tenantId,
    ).toBe(TENANT_B);
    expect(
      await repository.loadCheck(TENANT_A, VENUE_ID, "check_missing"),
    ).toBeNull();
    expect(
      await repository.load(TENANT_A, VENUE_ID, "table_missing"),
    ).toBeNull();
  });
}
