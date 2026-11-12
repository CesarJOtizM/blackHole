import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import {
  checks,
  diningTables,
  orderLines,
  orders,
} from "#adapters/postgres/schema.js";
import { DiningRoomRepository } from "#application/ports/dining-room-repository.js";
import { Check } from "#domain/check.js";
import { DiningTable, type TableState } from "#domain/dining-table.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DiningTableRow = typeof diningTables.$inferSelect;
type CheckRow = typeof checks.$inferSelect;
type OrderRow = typeof orders.$inferSelect;
type OrderLineRow = typeof orderLines.$inferSelect;
type LineState = "held" | "sent" | "in_preparation" | "ready" | "delivered";
type OrderChannel = "waiter" | "fixed_point" | "qr_table";

interface StoredTable {
  id: string;
  tenantId: string;
  venueId: string;
  zone: string;
  state: TableState;
  diners: number;
}

interface PersistedLine {
  id: string;
  productId: string;
  name: string;
  course: number;
  price: number;
  state: LineState;
  originTableId: string;
  variantIds?: readonly string[];
  modifierIds?: readonly string[];
  note?: string;
  sentAt?: string;
  inPreparationAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  stationId?: string;
}

interface PersistedOrder {
  id: string;
  channel: OrderChannel;
  lines: PersistedLine[];
}

interface StoredCheck {
  id: string;
  tenantId: string;
  venueId: string;
  tableId: string;
  openedAt: string;
  waiterId: string | null;
  diners: number | null;
  releasedAt: string | null;
  chargedAt: string | null;
  firstSentAt: string | null;
  tableState: string;
  preBillRequestedAt: string | null;
  orders: PersistedOrder[];
}

interface CourseSend {
  course: number;
  sentAt: string;
}

const TABLE_STATES = new Set<TableState>([
  "free",
  "occupied",
  "check_requested",
  "to_clean",
]);

export class DrizzleDiningRoomRepository extends DiningRoomRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async load(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<DiningTable | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(diningTables)
        .where(
          and(eq(diningTables.venueId, venueId), eq(diningTables.id, tableId)),
        );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];

      if (row === undefined || rows.length !== 1 || row.tenantId !== tenantId) {
        throw new Error("Stored dining table does not match the tenant.");
      }

      return restoreTable(row);
    });
  }

  override async save(table: DiningTable): Promise<void> {
    const stored = snapshotTable(table);

    await this.inTenant(stored.tenantId, async (tx) => {
      await replaceTable(tx, stored);
    });
  }

  override async loadCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<Check | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(checks)
        .where(and(eq(checks.venueId, venueId), eq(checks.id, checkId)));

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];

      if (row === undefined || rows.length !== 1 || row.tenantId !== tenantId) {
        throw new Error("Stored check does not match the tenant.");
      }

      const storedOrders = await readOrders(tx, tenantId, row.venueId, row.id);

      return restoreCheck(row, storedOrders.get(row.id) ?? []);
    });
  }

  override async loadOpenCheckByTable(
    tenantId: string,
    venueId: string,
    tableId: string,
  ): Promise<Check | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(checks)
        .where(
          and(
            eq(checks.venueId, venueId),
            eq(checks.tableId, tableId),
            or(
              eq(checks.tableState, "occupied"),
              eq(checks.tableState, "check_requested"),
            ),
          ),
        )
        .orderBy(asc(checks.id));
      const row = rows.find((candidate) => candidate.tenantId === tenantId);

      if (row === undefined) {
        return null;
      }

      const storedOrders = await readOrders(tx, tenantId, row.venueId, row.id);

      return restoreCheck(row, storedOrders.get(row.id) ?? []);
    });
  }

  override async saveCheck(check: Check): Promise<void> {
    await this.saveChecks([check]);
  }

  override async saveChecks(savedChecks: readonly Check[]): Promise<void> {
    const stored = savedChecks.map(snapshotCheck);
    const tenantId = stored[0]?.tenantId;

    if (tenantId === undefined) {
      return;
    }

    if (stored.some((check) => check.tenantId !== tenantId)) {
      throw new Error("A joined save must stay inside one tenant.");
    }

    await this.inTenant(tenantId, async (tx) => {
      for (const check of stored) {
        await replaceCheck(tx, check);
      }
    });
  }

  override async listTables(
    tenantId: string,
    venueId: string,
  ): Promise<readonly DiningTable[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(diningTables)
        .where(eq(diningTables.venueId, venueId))
        .orderBy(asc(diningTables.id));

      if (rows.some((row) => row.tenantId !== tenantId)) {
        throw new Error("Stored dining table does not match the tenant.");
      }

      return rows.map(restoreTable);
    });
  }

  override async listChecks(
    tenantId: string,
    venueId: string,
  ): Promise<readonly Check[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(checks)
        .where(eq(checks.venueId, venueId))
        .orderBy(asc(checks.id));

      if (rows.some((row) => row.tenantId !== tenantId)) {
        throw new Error("Stored check does not match the tenant.");
      }

      const storedOrders = await readOrders(tx, tenantId, venueId);

      return rows.map((row) =>
        restoreCheck(row, storedOrders.get(row.id) ?? []),
      );
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE orders_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

function snapshotTable(table: DiningTable): StoredTable {
  return {
    id: table.id,
    tenantId: table.tenantId,
    venueId: table.venueId,
    zone: table.zone,
    state: table.state,
    diners: table.diners,
  };
}

function snapshotCheck(check: Check): StoredCheck {
  return {
    id: check.id,
    tenantId: check.tenantId,
    venueId: check.venueId,
    tableId: check.tableId,
    openedAt: check.openedAt,
    waiterId: check.waiterId,
    diners: check.diners,
    releasedAt: check.releasedAt ?? null,
    chargedAt: check.chargedAt ?? null,
    firstSentAt: check.firstSentAt ?? null,
    tableState: check.tableState,
    preBillRequestedAt: check.preBillRequest?.requestedAt ?? null,
    orders: snapshotOrders(check.orders),
  };
}

async function replaceTable(
  tx: Transaction,
  table: StoredTable,
): Promise<void> {
  await tx
    .delete(diningTables)
    .where(
      and(
        eq(diningTables.tenantId, table.tenantId),
        eq(diningTables.venueId, table.venueId),
        eq(diningTables.id, table.id),
      ),
    );
  await tx.insert(diningTables).values(table);
}

async function replaceCheck(
  tx: Transaction,
  check: StoredCheck,
): Promise<void> {
  await tx
    .delete(orderLines)
    .where(
      and(
        eq(orderLines.tenantId, check.tenantId),
        eq(orderLines.venueId, check.venueId),
        eq(orderLines.checkId, check.id),
      ),
    );
  await tx
    .delete(orders)
    .where(
      and(
        eq(orders.tenantId, check.tenantId),
        eq(orders.venueId, check.venueId),
        eq(orders.checkId, check.id),
      ),
    );
  await tx
    .delete(checks)
    .where(
      and(
        eq(checks.tenantId, check.tenantId),
        eq(checks.venueId, check.venueId),
        eq(checks.id, check.id),
      ),
    );
  await tx.insert(checks).values({
    id: check.id,
    tenantId: check.tenantId,
    venueId: check.venueId,
    tableId: check.tableId,
    openedAt: check.openedAt,
    waiterId: check.waiterId,
    diners: check.diners,
    releasedAt: check.releasedAt,
    chargedAt: check.chargedAt,
    firstSentAt: check.firstSentAt,
    tableState: check.tableState,
    preBillRequestedAt: check.preBillRequestedAt,
  });
  await insertOrders(tx, check);
  await notifyOrderIds(tx, check);
}

async function insertOrders(
  tx: Transaction,
  check: StoredCheck,
): Promise<void> {
  if (check.orders.length === 0) {
    return;
  }

  await tx.insert(orders).values(
    check.orders.map((order, position) => ({
      id: order.id,
      tenantId: check.tenantId,
      venueId: check.venueId,
      checkId: check.id,
      channel: order.channel,
      position,
    })),
  );

  const lines = check.orders.flatMap((order) =>
    order.lines.map((line, position) => ({
      id: line.id,
      tenantId: check.tenantId,
      venueId: check.venueId,
      checkId: check.id,
      orderId: order.id,
      productId: line.productId,
      name: line.name,
      course: line.course,
      price: line.price,
      state: line.state,
      originTableId: line.originTableId,
      note: line.note ?? null,
      variantIds: [...(line.variantIds ?? [])],
      modifierIds: [...(line.modifierIds ?? [])],
      sentAt: line.sentAt ?? null,
      inPreparationAt: line.inPreparationAt ?? null,
      readyAt: line.readyAt ?? null,
      deliveredAt: line.deliveredAt ?? null,
      stationId: line.stationId ?? null,
      position,
    })),
  );

  if (lines.length === 0) {
    return;
  }

  await tx.insert(orderLines).values(lines);
}

async function notifyOrderIds(
  tx: Transaction,
  check: StoredCheck,
): Promise<void> {
  const payload = JSON.stringify({
    kind: "ids",
    tenantId: check.tenantId,
    venueId: check.venueId,
    checkId: check.id,
    tableId: check.tableId,
    lineIds: check.orders.flatMap((order) =>
      order.lines.map((line) => line.id),
    ),
  });

  await tx.execute(sql`SELECT pg_notify('orders_realtime', ${payload})`);
}

function restoreTable(row: DiningTableRow): DiningTable {
  if (!isTableState(row.state)) {
    throw new Error("Stored dining table cannot be restored.");
  }

  const table = DiningTable.place({
    id: row.id,
    tenantId: row.tenantId,
    venueId: row.venueId,
    zone: row.zone,
  });

  if (row.state === "free") {
    if (row.diners !== 0) {
      throw new Error("Stored dining table cannot be restored.");
    }

    return table;
  }

  table.open({ diners: row.diners });

  if (row.state === "check_requested") {
    table.requestCheck();
  }

  if (row.state === "to_clean") {
    table.release();
  }

  return table;
}

function restoreCheck(
  row: CheckRow,
  storedOrders: readonly PersistedOrder[],
): Check {
  const check = Check.open({
    id: row.id,
    tenantId: row.tenantId,
    venueId: row.venueId,
    tableId: row.tableId,
    openedAt: row.openedAt,
    diners: row.diners,
  });

  if (row.releasedAt !== null) {
    check.stampReleased({ releasedAt: row.releasedAt });
  }

  if (row.chargedAt !== null) {
    check.stampCharged({ chargedAt: row.chargedAt });
  }

  if (row.waiterId !== null) {
    check.assignWaiter(row.waiterId);
  }

  for (const order of storedOrders) {
    for (const line of order.lines) {
      if (line.originTableId !== row.tableId) {
        throw new Error("Stored check cannot be restored.");
      }

      check.addLine({
        orderId: order.id,
        lineId: line.id,
        productId: line.productId,
        name: line.name,
        course: line.course,
        price: line.price,
        channel: order.channel,
        ...(line.variantIds === undefined
          ? {}
          : { variantIds: line.variantIds }),
        ...(line.modifierIds === undefined
          ? {}
          : { modifierIds: line.modifierIds }),
        ...(line.note === undefined ? {} : { note: line.note }),
      });
    }
  }

  for (const course of coursesToSend(storedOrders)) {
    check.send(course);
  }

  for (const order of storedOrders) {
    for (const line of order.lines) {
      advanceStoredLine(check, line);
    }
  }

  if (row.tableState === "check_requested") {
    if (row.preBillRequestedAt === null) {
      check.requestCheck();
    } else {
      check.requestCheck({ requestedAt: row.preBillRequestedAt });
    }
  } else if (row.tableState !== "occupied" || row.preBillRequestedAt !== null) {
    throw new Error("Stored check cannot be restored.");
  }

  if ((check.firstSentAt ?? null) !== row.firstSentAt) {
    throw new Error("Stored check cannot be restored.");
  }

  if (check.tableState !== row.tableState) {
    throw new Error("Stored check cannot be restored.");
  }

  if ((check.preBillRequest?.requestedAt ?? null) !== row.preBillRequestedAt) {
    throw new Error("Stored check cannot be restored.");
  }

  return check;
}

function coursesToSend(orders: readonly PersistedOrder[]): CourseSend[] {
  const byCourse = new Map<number, PersistedLine[]>();

  for (const order of orders) {
    for (const line of order.lines) {
      const group = byCourse.get(line.course) ?? [];
      group.push(line);
      byCourse.set(line.course, group);
    }
  }

  const courses: CourseSend[] = [];

  for (const [course, lines] of byCourse) {
    const held = lines.some((line) => line.state === "held");
    const sent = lines.some((line) => line.state !== "held");

    if (held && sent) {
      throw new Error("Stored check cannot be restored.");
    }

    if (!sent) {
      continue;
    }

    const sentAt = lines[0]?.sentAt;

    if (sentAt === undefined || lines.some((line) => line.sentAt !== sentAt)) {
      throw new Error("Stored check cannot be restored.");
    }

    courses.push({ course, sentAt });
  }

  return courses.sort(
    (left, right) =>
      left.sentAt.localeCompare(right.sentAt) || left.course - right.course,
  );
}

function advanceStoredLine(check: Check, line: PersistedLine): void {
  if (line.state === "held" || line.state === "sent") {
    return;
  }

  const inPreparationAt = requiredStamp(line.inPreparationAt);
  check.advance({
    lineId: line.id,
    state: "in_preparation",
    at: inPreparationAt,
    ...(line.stationId === undefined ? {} : { stationId: line.stationId }),
  });

  if (line.state === "in_preparation") {
    return;
  }

  check.advance({
    lineId: line.id,
    state: "ready",
    at: requiredStamp(line.readyAt),
  });

  if (line.state === "ready") {
    return;
  }

  if (line.state !== "delivered") {
    throw new Error("Stored check cannot be restored.");
  }

  check.advance({
    lineId: line.id,
    state: "delivered",
    at: requiredStamp(line.deliveredAt),
  });
}

function requiredStamp(value: string | undefined): string {
  if (value === undefined) {
    throw new Error("Stored check cannot be restored.");
  }

  return value;
}

function snapshotOrders(source: Check["orders"]): PersistedOrder[] {
  return source.map((order) => ({
    id: order.id,
    channel: order.channel,
    lines: order.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      name: line.name,
      course: line.course,
      price: line.price,
      state: line.state,
      originTableId: line.originTableId,
      ...(line.variantIds === undefined
        ? {}
        : { variantIds: [...line.variantIds] }),
      ...(line.modifierIds === undefined
        ? {}
        : { modifierIds: [...line.modifierIds] }),
      ...(line.note === undefined ? {} : { note: line.note }),
      ...(line.sentAt === undefined ? {} : { sentAt: line.sentAt }),
      ...(line.inPreparationAt === undefined
        ? {}
        : { inPreparationAt: line.inPreparationAt }),
      ...(line.readyAt === undefined ? {} : { readyAt: line.readyAt }),
      ...(line.deliveredAt === undefined
        ? {}
        : { deliveredAt: line.deliveredAt }),
      ...(line.stationId === undefined ? {} : { stationId: line.stationId }),
    })),
  }));
}

async function readOrders(
  tx: Transaction,
  tenantId: string,
  venueId: string,
  checkId?: string,
): Promise<Map<string, PersistedOrder[]>> {
  const orderRows = await tx
    .select()
    .from(orders)
    .where(
      checkId === undefined
        ? eq(orders.venueId, venueId)
        : and(eq(orders.venueId, venueId), eq(orders.checkId, checkId)),
    )
    .orderBy(asc(orders.position), asc(orders.id));
  const lineRows = await tx
    .select()
    .from(orderLines)
    .where(
      checkId === undefined
        ? eq(orderLines.venueId, venueId)
        : and(eq(orderLines.venueId, venueId), eq(orderLines.checkId, checkId)),
    )
    .orderBy(asc(orderLines.position), asc(orderLines.id));

  if (
    orderRows.some((row) => row.tenantId !== tenantId) ||
    lineRows.some((row) => row.tenantId !== tenantId)
  ) {
    throw new Error("Stored check does not match the tenant.");
  }

  return groupOrders(orderRows, lineRows);
}

function groupOrders(
  orderRows: readonly OrderRow[],
  lineRows: readonly OrderLineRow[],
): Map<string, PersistedOrder[]> {
  const linesByOrder = new Map<string, PersistedLine[]>();

  for (const row of lineRows) {
    const group = linesByOrder.get(row.orderId) ?? [];
    group.push(lineFromRow(row));
    linesByOrder.set(row.orderId, group);
  }

  const byCheck = new Map<string, PersistedOrder[]>();

  for (const row of orderRows) {
    const group = byCheck.get(row.checkId) ?? [];
    group.push({
      id: row.id,
      channel: channelOf(row.channel),
      lines: linesByOrder.get(row.id) ?? [],
    });
    byCheck.set(row.checkId, group);
    linesByOrder.delete(row.id);
  }

  if (linesByOrder.size > 0) {
    throw new Error("Stored check cannot be restored.");
  }

  return byCheck;
}

function lineFromRow(row: OrderLineRow): PersistedLine {
  if (!isLineState(row.state)) {
    throw new Error("Stored check cannot be restored.");
  }

  const variantIds = stringList(row.variantIds);
  const modifierIds = stringList(row.modifierIds);

  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    course: row.course,
    price: row.price,
    state: row.state,
    originTableId: row.originTableId,
    ...(variantIds.length === 0 ? {} : { variantIds }),
    ...(modifierIds.length === 0 ? {} : { modifierIds }),
    ...(row.note === null ? {} : { note: row.note }),
    ...(row.sentAt === null ? {} : { sentAt: row.sentAt }),
    ...(row.inPreparationAt === null
      ? {}
      : { inPreparationAt: row.inPreparationAt }),
    ...(row.readyAt === null ? {} : { readyAt: row.readyAt }),
    ...(row.deliveredAt === null ? {} : { deliveredAt: row.deliveredAt }),
    ...(row.stationId === null ? {} : { stationId: row.stationId }),
  };
}

function stringList(value: unknown): readonly string[] {
  const parsed = typeof value === "string" ? parseJson(value) : value;

  if (
    !Array.isArray(parsed) ||
    parsed.some((item) => typeof item !== "string")
  ) {
    throw new Error("Stored check cannot be restored.");
  }

  return parsed;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Stored check cannot be restored.");
  }
}

function channelOf(value: string): OrderChannel {
  if (!isChannel(value)) {
    throw new Error("Stored check cannot be restored.");
  }

  return value;
}

function isChannel(value: unknown): value is OrderChannel {
  return value === "waiter" || value === "fixed_point" || value === "qr_table";
}

function isLineState(value: unknown): value is LineState {
  return (
    value === "held" ||
    value === "sent" ||
    value === "in_preparation" ||
    value === "ready" ||
    value === "delivered"
  );
}

function isTableState(value: string): value is TableState {
  return TABLE_STATES.has(value as TableState);
}
