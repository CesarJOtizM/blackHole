import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import type {
  TransferInMovement,
  TransferReceiptWrite,
} from "#application/ports/transfer-repository.js";
import { TransferRepository } from "#application/ports/transfer-repository.js";
import { MOVEMENT_TYPE } from "#domain/stock-ledger.js";
import {
  TRANSFER_STATUS,
  Transfer,
  type TransferStatus,
} from "#domain/transfer.js";

const RECEIPT_FAILED = "The transfer receipt insert failed.";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface StoredLine {
  ingredientId: string;
  quantity: number;
  unitCost: number | null;
  receivedQuantity: number | null;
  shortfall: number | null;
}

interface StoredTransfer {
  id: string;
  originLocationId: string;
  destinationLocationId: string;
  status: TransferStatus;
  dispatchedAt: string | null;
  inTransitAt: string | null;
  dispatchedBy: string | null;
  receivedAt: string | null;
  receivedBy: string | null;
  lines: StoredLine[];
}

interface TransferRow {
  id: string;
  origin_location_id: string;
  destination_location_id: string;
  status: string;
  dispatched_at: string | null;
  in_transit_at: string | null;
  dispatched_by: string | null;
  received_at: string | null;
  received_by: string | null;
}

interface LineRow {
  position: number | string;
  ingredient_id: string;
  quantity: number | string;
  unit_cost: number | string | null;
  received_quantity: number | string | null;
  shortfall: number | string | null;
}

interface BalanceRow {
  quantity: number | string;
  average_cost: number | string;
}

interface MovementRow {
  id: string;
  venue_id: string;
  location_id: string;
  ingredient_id: string;
  quantity: number | string;
  unit_cost: number | string;
  reference: string;
  occurred_at: string;
  actor_id: string;
}

interface PositionRow {
  position: number | string;
}

interface CountRow {
  count: number | string;
}

const STATUSES = new Set<string>(Object.values(TRANSFER_STATUS));

const rowsOf = <T>(result: unknown): T[] => {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (
    result !== null &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as T[];
  }

  return [];
};

const asNumber = (value: number | string): number => Number(value);

const nullableNumber = (value: number | string | null): number | null =>
  value === null ? null : asNumber(value);

const statusOf = (status: string): TransferStatus => {
  if (!STATUSES.has(status)) {
    throw new Error("The transfer status is unknown.");
  }

  return status as TransferStatus;
};

const rehydrate = (stored: StoredTransfer): Transfer => {
  const transfer = Transfer.request({
    id: stored.id,
    originLocationId: stored.originLocationId,
    destinationLocationId: stored.destinationLocationId,
    lines: stored.lines.map((line) => ({
      ingredientId: line.ingredientId,
      quantity: line.quantity,
    })),
  });

  if (stored.status === TRANSFER_STATUS.REQUESTED) {
    return transfer;
  }

  const occurredAt = stored.dispatchedAt ?? stored.inTransitAt;
  const actorId = stored.dispatchedBy;

  if (occurredAt === null || actorId === null) {
    throw new Error("A dispatched transfer is missing its stamp.");
  }

  transfer.dispatch({
    actorId,
    occurredAt,
    origin: stored.lines.map((line) => ({
      ingredientId: line.ingredientId,
      onHand: line.quantity,
      averageCost: line.unitCost ?? 0,
    })),
  });

  if (stored.status === TRANSFER_STATUS.IN_TRANSIT) {
    return transfer;
  }

  if (stored.receivedAt === null || stored.receivedBy === null) {
    throw new Error("A received transfer is missing its stamp.");
  }

  transfer.receive({
    actorId: stored.receivedBy,
    occurredAt: stored.receivedAt,
    lines: stored.lines.map((line) => ({
      ingredientId: line.ingredientId,
      receivedQuantity: line.receivedQuantity ?? 0,
      onHand: 0,
      averageCost: 0,
    })),
  });

  return transfer;
};

const snapshotOf = (transfer: Transfer): StoredTransfer => ({
  id: transfer.id,
  originLocationId: transfer.originLocationId,
  destinationLocationId: transfer.destinationLocationId,
  status: transfer.status,
  dispatchedAt: transfer.dispatchedAt ?? null,
  inTransitAt: transfer.inTransitAt ?? null,
  dispatchedBy: transfer.dispatchedBy ?? null,
  receivedAt: transfer.receivedAt ?? null,
  receivedBy: transfer.receivedBy ?? null,
  lines: transfer.lines.map((line) => ({
    ingredientId: line.ingredientId,
    quantity: line.quantity,
    unitCost: line.unitCost ?? null,
    receivedQuantity: line.receivedQuantity ?? null,
    shortfall: line.shortfall ?? null,
  })),
});

export class DrizzleTransferRepository extends TransferRepository {
  private readonly database: Database;
  private failAt: number | null = null;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  failOnInsert(ordinal: number): void {
    this.failAt = ordinal;
  }

  async balance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.inTenant(tenantId, async (tx) => {
      const holding = await this.holding(
        tx,
        tenantId,
        locationId,
        ingredientId,
      );

      return holding.quantity;
    });
  }

  async averageCost(
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<number> {
    return this.inTenant(tenantId, async (tx) => {
      const holding = await this.holding(
        tx,
        tenantId,
        locationId,
        ingredientId,
      );

      return holding.averageCost;
    });
  }

  async movements(tenantId: string): Promise<readonly TransferInMovement[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = rowsOf<MovementRow>(
        await tx.execute(sql`
          SELECT
            id,
            venue_id,
            location_id,
            ingredient_id,
            quantity,
            unit_cost,
            reference,
            occurred_at,
            actor_id
          FROM stock_movements
          WHERE tenant_id = ${tenantId}
            AND movement_type = ${MOVEMENT_TYPE.TRANSFER_IN}
          ORDER BY position
        `),
      );

      return rows.map((row) => ({
        id: row.id,
        tenantId,
        venueId: row.venue_id,
        locationId: row.location_id,
        ingredientId: row.ingredient_id,
        quantity: asNumber(row.quantity),
        unitCost: asNumber(row.unit_cost),
        type: MOVEMENT_TYPE.TRANSFER_IN,
        reference: row.reference,
        occurredAt: row.occurred_at,
        actorId: row.actor_id,
        orderLineId: null,
        role: null,
        recipeVersion: null,
      }));
    });
  }

  async outboxCount(tenantId: string): Promise<number> {
    return this.inTenant(tenantId, async (tx) => {
      const [row] = rowsOf<CountRow>(
        await tx.execute(sql`
          SELECT count(*) AS count
          FROM stock_movement_outbox
          WHERE tenant_id = ${tenantId}
        `),
      );

      return asNumber(row?.count ?? 0);
    });
  }

  async seedBalance(
    tenantId: string,
    locationId: string,
    ingredientId: string,
    quantity: number,
    averageCost: number,
  ): Promise<void> {
    await this.inTenant(tenantId, async (tx) => {
      await tx.execute(sql`
        INSERT INTO stock_balances (
          tenant_id,
          location_id,
          ingredient_id,
          quantity,
          average_cost
        )
        VALUES (
          ${tenantId},
          ${locationId},
          ${ingredientId},
          ${quantity},
          ${averageCost}
        )
        ON CONFLICT (tenant_id, location_id, ingredient_id) DO UPDATE SET
          quantity = excluded.quantity,
          average_cost = excluded.average_cost
      `);
    });
  }

  override async save(tenantId: string, transfer: Transfer): Promise<void> {
    const stored = snapshotOf(transfer);

    await this.inTenant(tenantId, async (tx) => {
      await this.writeTransfer(tx, tenantId, stored);
    });
  }

  override async find(
    tenantId: string,
    transferId: string,
  ): Promise<Transfer | null> {
    return this.inTenant(tenantId, async (tx) => {
      const stored = await this.readTransfer(tx, tenantId, transferId);

      return stored === null ? null : rehydrate(stored);
    });
  }

  override async receive(
    tenantId: string,
    receipt: TransferReceiptWrite,
  ): Promise<void> {
    const failAt = this.failAt;
    this.failAt = null;
    const stored = snapshotOf(receipt.transfer);

    await this.inTenant(tenantId, async (tx) => {
      const existing = await this.readTransfer(tx, tenantId, stored.id);

      if (!existing) {
        throw new Error("The transfer does not exist.");
      }

      await this.writeTransfer(tx, tenantId, stored);
      let position = await this.nextPosition(tx);

      for (const [index, movement] of receipt.movements.entries()) {
        if (failAt === index + 1) {
          throw new Error(RECEIPT_FAILED);
        }

        if (movement.type !== MOVEMENT_TYPE.TRANSFER_IN) {
          throw new Error(RECEIPT_FAILED);
        }

        await this.insertMovement(tx, movement, position);
        await this.addBalance(tx, movement, receipt);
        position += 1;
      }
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE inventory_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }

  private async writeTransfer(
    tx: Transaction,
    tenantId: string,
    stored: StoredTransfer,
  ): Promise<void> {
    await tx.execute(sql`
      INSERT INTO transfers (
        tenant_id,
        id,
        origin_location_id,
        destination_location_id,
        status,
        dispatched_at,
        in_transit_at,
        dispatched_by,
        received_at,
        received_by
      )
      VALUES (
        ${tenantId},
        ${stored.id},
        ${stored.originLocationId},
        ${stored.destinationLocationId},
        ${stored.status},
        ${stored.dispatchedAt},
        ${stored.inTransitAt},
        ${stored.dispatchedBy},
        ${stored.receivedAt},
        ${stored.receivedBy}
      )
      ON CONFLICT (tenant_id, id) DO UPDATE SET
        origin_location_id = excluded.origin_location_id,
        destination_location_id = excluded.destination_location_id,
        status = excluded.status,
        dispatched_at = excluded.dispatched_at,
        in_transit_at = excluded.in_transit_at,
        dispatched_by = excluded.dispatched_by,
        received_at = excluded.received_at,
        received_by = excluded.received_by
    `);

    for (const [index, line] of stored.lines.entries()) {
      await tx.execute(sql`
        INSERT INTO transfer_lines (
          tenant_id,
          transfer_id,
          position,
          ingredient_id,
          quantity,
          unit_cost,
          received_quantity,
          shortfall
        )
        VALUES (
          ${tenantId},
          ${stored.id},
          ${index + 1},
          ${line.ingredientId},
          ${line.quantity},
          ${line.unitCost},
          ${line.receivedQuantity},
          ${line.shortfall}
        )
        ON CONFLICT (tenant_id, transfer_id, position) DO UPDATE SET
          ingredient_id = excluded.ingredient_id,
          quantity = excluded.quantity,
          unit_cost = excluded.unit_cost,
          received_quantity = excluded.received_quantity,
          shortfall = excluded.shortfall
      `);
    }
  }

  private async readTransfer(
    tx: Transaction,
    tenantId: string,
    transferId: string,
  ): Promise<StoredTransfer | null> {
    const [row] = rowsOf<TransferRow>(
      await tx.execute(sql`
        SELECT
          id,
          origin_location_id,
          destination_location_id,
          status,
          dispatched_at,
          in_transit_at,
          dispatched_by,
          received_at,
          received_by
        FROM transfers
        WHERE tenant_id = ${tenantId}
          AND id = ${transferId}
      `),
    );

    if (!row) {
      return null;
    }

    const lines = rowsOf<LineRow>(
      await tx.execute(sql`
        SELECT
          position,
          ingredient_id,
          quantity,
          unit_cost,
          received_quantity,
          shortfall
        FROM transfer_lines
        WHERE tenant_id = ${tenantId}
          AND transfer_id = ${transferId}
        ORDER BY position
      `),
    );

    return {
      id: row.id,
      originLocationId: row.origin_location_id,
      destinationLocationId: row.destination_location_id,
      status: statusOf(row.status),
      dispatchedAt: row.dispatched_at,
      inTransitAt: row.in_transit_at,
      dispatchedBy: row.dispatched_by,
      receivedAt: row.received_at,
      receivedBy: row.received_by,
      lines: lines.map((line) => ({
        ingredientId: line.ingredient_id,
        quantity: asNumber(line.quantity),
        unitCost: nullableNumber(line.unit_cost),
        receivedQuantity: nullableNumber(line.received_quantity),
        shortfall: nullableNumber(line.shortfall),
      })),
    };
  }

  private async insertMovement(
    tx: Transaction,
    movement: TransferInMovement,
    position: number,
  ): Promise<void> {
    await tx.execute(sql`
      INSERT INTO stock_movements (
        tenant_id,
        id,
        position,
        venue_id,
        location_id,
        ingredient_id,
        quantity,
        unit_cost,
        movement_type,
        reference,
        occurred_at,
        order_line_id,
        role,
        recipe_version,
        reason,
        actor_id,
        reverses_movement_id
      )
      VALUES (
        ${movement.tenantId},
        ${movement.id},
        ${position},
        ${movement.venueId},
        ${movement.locationId},
        ${movement.ingredientId},
        ${movement.quantity},
        ${movement.unitCost},
        ${movement.type},
        ${movement.reference},
        ${movement.occurredAt},
        NULL,
        NULL,
        NULL,
        NULL,
        ${movement.actorId},
        NULL
      )
    `);
  }

  private async addBalance(
    tx: Transaction,
    movement: TransferInMovement,
    receipt: TransferReceiptWrite,
  ): Promise<void> {
    const current = await this.holding(
      tx,
      movement.tenantId,
      movement.locationId,
      movement.ingredientId,
    );
    const average =
      receipt.averages.find(
        (item) =>
          item.locationId === movement.locationId &&
          item.ingredientId === movement.ingredientId,
      )?.averageCost ?? current.averageCost;

    await tx.execute(sql`
      INSERT INTO stock_balances (
        tenant_id,
        location_id,
        ingredient_id,
        quantity,
        average_cost
      )
      VALUES (
        ${movement.tenantId},
        ${movement.locationId},
        ${movement.ingredientId},
        ${movement.quantity},
        ${average}
      )
      ON CONFLICT (tenant_id, location_id, ingredient_id) DO UPDATE SET
        quantity = stock_balances.quantity + excluded.quantity,
        average_cost = excluded.average_cost
    `);
  }

  private async holding(
    tx: Transaction,
    tenantId: string,
    locationId: string,
    ingredientId: string,
  ): Promise<{ quantity: number; averageCost: number }> {
    const [row] = rowsOf<BalanceRow>(
      await tx.execute(sql`
        SELECT quantity, average_cost
        FROM stock_balances
        WHERE tenant_id = ${tenantId}
          AND location_id = ${locationId}
          AND ingredient_id = ${ingredientId}
      `),
    );

    return {
      quantity: row ? asNumber(row.quantity) : 0,
      averageCost: row ? asNumber(row.average_cost) : 0,
    };
  }

  private async nextPosition(tx: Transaction): Promise<number> {
    const [row] = rowsOf<PositionRow>(
      await tx.execute(sql`
        SELECT coalesce(max(position), 0) AS position
        FROM stock_movements
      `),
    );

    return asNumber(row?.position ?? 0) + 1;
  }
}
