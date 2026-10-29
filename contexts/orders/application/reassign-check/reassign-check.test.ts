import { expect, it, vi } from "vitest";

import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { ReassignCheck } from "#application/reassign-check/reassign-check.js";
import { Check, TableNotOpen } from "#domain/check.js";
import { DiningTable, type TableState } from "#domain/dining-table.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TARGET_TABLE_ID = "table_5";
const SOURCE_TABLE_ID = "table_6";
const TARGET_CHECK_ID = "check_5";
const SOURCE_CHECK_ID = "check_6";
const OPENED_AT = "2026-10-28T12:00:00.000Z";
const SENT_AT = "2026-10-28T12:03:10.000Z";

interface LineInput {
  orderId: string;
  lineId: string;
  name: string;
  price: number;
}

const STEAK: LineInput = {
  orderId: "order_5",
  lineId: "line_steak",
  name: "Steak",
  price: 15_000,
};

const SOUP: LineInput = {
  orderId: "order_6",
  lineId: "line_soup",
  name: "Soup",
  price: 9_000,
};

const SALAD: LineInput = {
  orderId: "order_6",
  lineId: "line_salad",
  name: "Salad",
  price: 8_000,
};

class MemoryDiningRoom extends DiningRoomRepository {
  private readonly tables = new Map<string, DiningTable>();
  private readonly checks = new Map<string, Check>();

  override async load(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<DiningTable | null> {
    return this.tables.get(`${tenantId}:${venueId}:${tableId}`) ?? null;
  }

  override async save(table: DiningTable): Promise<void> {
    this.tables.set(`${table.tenantId}:${table.venueId}:${table.id}`, table);
  }

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    return this.checks.get(`${tenantId}:${venueId}:${checkId}`) ?? null;
  }

  override async saveCheck(check: Check): Promise<void> {
    this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
  }

  override async saveChecks(checks: readonly Check[]): Promise<void> {
    for (const check of checks) {
      this.checks.set(`${check.tenantId}:${check.venueId}:${check.id}`, check);
    }
  }
}

const placeTable = (id: string, state: TableState): DiningTable => {
  const table = DiningTable.place({
    id,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    zone: "Terrace",
  });

  if (state === "free") {
    return table;
  }

  table.open({ diners: 4 });

  if (state === "check_requested") {
    table.requestCheck();
  }

  if (state === "to_clean") {
    table.release();
  }

  return table;
};

const fillCheck = (
  check: Check,
  lines: readonly LineInput[],
  state: "occupied" | "check_requested",
) => {
  for (const line of lines) {
    check.addLine({
      orderId: line.orderId,
      lineId: line.lineId,
      productId: `menu_product_${line.name.toLowerCase()}`,
      name: line.name,
      course: 1,
      price: line.price,
      channel: "waiter",
    });
  }

  check.send({ course: 1, sentAt: SENT_AT });

  if (state === "check_requested") {
    check.requestCheck();
  }
};

const seat = async (input: {
  targetTable: TableState;
  sourceTable: TableState;
  targetCheck?: "occupied" | "check_requested";
  sourceCheck?: "occupied" | "check_requested";
  sourceLines?: readonly LineInput[];
}) => {
  const dining = new MemoryDiningRoom();
  const targetTable = placeTable(TARGET_TABLE_ID, input.targetTable);
  const sourceTable = placeTable(SOURCE_TABLE_ID, input.sourceTable);
  const target = Check.open({
    id: TARGET_CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TARGET_TABLE_ID,
    openedAt: OPENED_AT,
  });
  const source = Check.open({
    id: SOURCE_CHECK_ID,
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: SOURCE_TABLE_ID,
    openedAt: OPENED_AT,
  });

  fillCheck(target, [STEAK], input.targetCheck ?? "occupied");
  fillCheck(
    source,
    input.sourceLines ?? [SOUP],
    input.sourceCheck ?? "occupied",
  );
  await dining.save(targetTable);
  await dining.save(sourceTable);
  await dining.saveCheck(target);
  await dining.saveCheck(source);

  return {
    dining,
    reassign: new ReassignCheck(dining),
    target,
    source,
  };
};

const linesOf = (check: Check | null | undefined) =>
  check?.orders.flatMap((order) => order.lines) ?? [];

it("given table 6 joined into table 5, when the waiter joins them, then table 5 holds both lines and each originTableId stays", async () => {
  const { dining, reassign } = await seat({
    targetTable: "occupied",
    sourceTable: "check_requested",
    sourceCheck: "check_requested",
  });

  await reassign.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    targetCheckId: TARGET_CHECK_ID,
    sourceCheckId: SOURCE_CHECK_ID,
    kind: "join",
  });

  const storedTarget = await dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    TARGET_CHECK_ID,
  );
  const storedSource = await dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    SOURCE_CHECK_ID,
  );
  expect(storedTarget?.id).toBe(TARGET_CHECK_ID);
  expect(storedSource?.id).toBe(SOURCE_CHECK_ID);
  expect(storedTarget?.tableId).toBe(TARGET_TABLE_ID);
  expect(storedSource?.tableId).toBe(SOURCE_TABLE_ID);
  expect(storedTarget?.tableState).toBe("occupied");
  expect(storedSource?.tableState).toBe("check_requested");
  expect(storedSource?.orders).toEqual([]);
  expect(storedTarget?.total).toBe(24_000);
  expect(linesOf(storedTarget)).toEqual([
    expect.objectContaining({
      id: "line_steak",
      originTableId: TARGET_TABLE_ID,
    }),
    expect.objectContaining({
      id: "line_soup",
      originTableId: SOURCE_TABLE_ID,
    }),
  ]);
  expect((await dining.load(TENANT_ID, VENUE_ID, TARGET_TABLE_ID))?.state).toBe(
    "occupied",
  );
  expect((await dining.load(TENANT_ID, VENUE_ID, SOURCE_TABLE_ID))?.state).toBe(
    "check_requested",
  );
});

it("given a transfer, when lines move, then table states stay", async () => {
  const { dining, reassign } = await seat({
    targetTable: "check_requested",
    sourceTable: "occupied",
    targetCheck: "check_requested",
    sourceLines: [SOUP, SALAD],
  });

  await reassign.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    targetCheckId: TARGET_CHECK_ID,
    sourceCheckId: SOURCE_CHECK_ID,
    kind: "transfer",
    lineIds: ["line_salad"],
  });

  const storedTarget = await dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    TARGET_CHECK_ID,
  );
  const storedSource = await dining.loadCheck(
    TENANT_ID,
    VENUE_ID,
    SOURCE_CHECK_ID,
  );
  expect(storedTarget?.id).toBe(TARGET_CHECK_ID);
  expect(storedSource?.id).toBe(SOURCE_CHECK_ID);
  expect(storedTarget?.tableId).toBe(TARGET_TABLE_ID);
  expect(storedSource?.tableId).toBe(SOURCE_TABLE_ID);
  expect(storedTarget?.tableState).toBe("check_requested");
  expect(storedSource?.tableState).toBe("occupied");
  expect((await dining.load(TENANT_ID, VENUE_ID, TARGET_TABLE_ID))?.state).toBe(
    "check_requested",
  );
  expect((await dining.load(TENANT_ID, VENUE_ID, SOURCE_TABLE_ID))?.state).toBe(
    "occupied",
  );
  expect(linesOf(storedTarget)).toEqual([
    expect.objectContaining({
      id: "line_steak",
      originTableId: TARGET_TABLE_ID,
    }),
    expect.objectContaining({
      id: "line_salad",
      originTableId: SOURCE_TABLE_ID,
    }),
  ]);
  expect(linesOf(storedSource)).toEqual([
    expect.objectContaining({
      id: "line_soup",
      originTableId: SOURCE_TABLE_ID,
    }),
  ]);
});

it("given a to_clean or free table, when lines are reassigned, then TableNotOpen and nothing is saved", async () => {
  const cases = [
    {
      targetTable: "occupied",
      sourceTable: "free",
      kind: "join",
    },
    {
      targetTable: "to_clean",
      sourceTable: "occupied",
      kind: "join",
    },
    {
      targetTable: "free",
      sourceTable: "check_requested",
      kind: "transfer",
    },
    {
      targetTable: "check_requested",
      sourceTable: "to_clean",
      kind: "transfer",
    },
  ] as const;

  for (const attempt of cases) {
    const { dining, reassign, target, source } = await seat({
      targetTable: attempt.targetTable,
      sourceTable: attempt.sourceTable,
    });
    const before = {
      target: linesOf(target),
      source: linesOf(source),
    };
    const save = vi.spyOn(dining, "save");
    const saveCheck = vi.spyOn(dining, "saveCheck");
    const saveChecks = vi.spyOn(dining, "saveChecks");

    const reassignLines =
      attempt.kind === "join"
        ? reassign.execute({
            tenantId: TENANT_ID,
            venueId: VENUE_ID,
            targetCheckId: TARGET_CHECK_ID,
            sourceCheckId: SOURCE_CHECK_ID,
            kind: "join",
          })
        : reassign.execute({
            tenantId: TENANT_ID,
            venueId: VENUE_ID,
            targetCheckId: TARGET_CHECK_ID,
            sourceCheckId: SOURCE_CHECK_ID,
            kind: "transfer",
            lineIds: ["line_soup"],
          });

    await expect(reassignLines).rejects.toThrow(TableNotOpen);
    expect(save).not.toHaveBeenCalled();
    expect(saveCheck).not.toHaveBeenCalled();
    expect(saveChecks).not.toHaveBeenCalled();
    expect(
      linesOf(await dining.loadCheck(TENANT_ID, VENUE_ID, TARGET_CHECK_ID)),
    ).toEqual(before.target);
    expect(
      linesOf(await dining.loadCheck(TENANT_ID, VENUE_ID, SOURCE_CHECK_ID)),
    ).toEqual(before.source);
    expect(
      (await dining.load(TENANT_ID, VENUE_ID, TARGET_TABLE_ID))?.state,
    ).toBe(attempt.targetTable);
    expect(
      (await dining.load(TENANT_ID, VENUE_ID, SOURCE_TABLE_ID))?.state,
    ).toBe(attempt.sourceTable);
  }
});

it("given a join, when both checks change, then one save covers both checks", async () => {
  const { dining, reassign } = await seat({
    targetTable: "occupied",
    sourceTable: "occupied",
  });
  const save = vi.spyOn(dining, "save");
  const saveCheck = vi.spyOn(dining, "saveCheck");
  const saveChecks = vi.spyOn(dining, "saveChecks");

  await reassign.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    targetCheckId: TARGET_CHECK_ID,
    sourceCheckId: SOURCE_CHECK_ID,
    kind: "join",
  });

  expect(save).not.toHaveBeenCalled();
  expect(saveCheck).not.toHaveBeenCalled();
  expect(saveChecks).toHaveBeenCalledTimes(1);
  const [saved] = saveChecks.mock.calls[0] ?? [];
  expect(saved?.map((check) => check.id)).toEqual([
    TARGET_CHECK_ID,
    SOURCE_CHECK_ID,
  ]);
  expect(
    linesOf(await dining.loadCheck(TENANT_ID, VENUE_ID, TARGET_CHECK_ID)),
  ).toHaveLength(2);
  expect(
    (await dining.loadCheck(TENANT_ID, VENUE_ID, SOURCE_CHECK_ID))?.orders,
  ).toEqual([]);
});
