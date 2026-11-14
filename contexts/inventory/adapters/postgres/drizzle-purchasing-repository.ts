import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import type {
  ConfirmPurchase,
  PurchaseReceipt,
  PurchaseReceiptLine,
} from "#application/ports/purchasing-repository.js";
import { PurchasingRepository } from "#application/ports/purchasing-repository.js";
import {
  InvalidPurchase,
  PURCHASE_ORDER_STATUS,
  type PurchaseOrder,
  Purchasing,
  toBaseReceipt,
} from "#domain/purchasing.js";
import { MOVEMENT_TYPE, nextAverageCost } from "#domain/stock-ledger.js";

const RECEIPT_FAILED = "The purchase receipt insert failed.";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface SupplierRow {
  id: string;
  identification: string;
  name: string;
  issues_e_invoices: boolean;
  lead_time_days: number;
}

interface OrderRow {
  id: string;
  supplier_id: string;
  location_id: string;
  status: string;
}

interface OrderLineRow {
  order_id: string;
  id: string;
  ingredient_id: string;
  purchase_quantity: number;
  received_quantity: number;
  factor: number;
}

interface ReceiptRow {
  id: string;
  location_id: string;
  actor_id: string;
  occurred_at: string;
  purchase_order_id: string | null;
}

interface ReceiptLineRow {
  receipt_id: string;
  position: number;
  ingredient_id: string;
  purchase_quantity: number;
  purchase_unit_cost: number;
  factor: number;
  quantity: number;
  unit_cost: number;
}

interface BalanceRow {
  quantity: number;
  average_cost: number;
}

interface MovementRow {
  id: string;
  location_id: string;
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
  reference: string;
  occurred_at: string;
  actor_id: string;
  order_line_id: string | null;
  role: string | null;
  recipe_version: number | null;
}

interface CountRow {
  position: number;
}

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

export class DrizzlePurchasingRepository extends PurchasingRepository {
  private readonly database: Database;
  private failAt: number | null = null;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  failOnInsert(ordinal: number): void {
    this.failAt = ordinal;
  }

  override async load(tenantId: string): Promise<Purchasing | null> {
    return this.inTenant(tenantId, (tx) => this.readBook(tx, tenantId));
  }

  override async save(purchasing: Purchasing): Promise<void> {
    await this.inTenant(purchasing.tenantId, async (tx) => {
      for (const supplier of purchasing.suppliers) {
        await tx.execute(sql`
          INSERT INTO suppliers (
            tenant_id,
            id,
            identification,
            name,
            issues_e_invoices,
            lead_time_days
          )
          VALUES (
            ${purchasing.tenantId},
            ${supplier.id},
            ${supplier.identification},
            ${supplier.name},
            ${supplier.issuesEInvoices},
            ${supplier.leadTimeDays}
          )
          ON CONFLICT (tenant_id, id) DO UPDATE SET
            identification = excluded.identification,
            name = excluded.name,
            issues_e_invoices = excluded.issues_e_invoices,
            lead_time_days = excluded.lead_time_days
        `);
      }

      for (const order of purchasing.orders) {
        await tx.execute(sql`
          INSERT INTO purchase_orders (
            tenant_id,
            id,
            supplier_id,
            location_id,
            status
          )
          VALUES (
            ${purchasing.tenantId},
            ${order.id},
            ${order.supplierId},
            ${order.locationId},
            ${order.status}
          )
          ON CONFLICT (tenant_id, id) DO UPDATE SET
            supplier_id = excluded.supplier_id,
            location_id = excluded.location_id,
            status = excluded.status
        `);

        for (const line of order.lines) {
          await tx.execute(sql`
            INSERT INTO purchase_order_lines (
              tenant_id,
              order_id,
              id,
              ingredient_id,
              purchase_quantity,
              received_quantity,
              factor
            )
            VALUES (
              ${purchasing.tenantId},
              ${order.id},
              ${line.id},
              ${line.ingredientId},
              ${line.purchaseQuantity},
              ${line.receivedQuantity},
              ${line.factor}
            )
            ON CONFLICT (tenant_id, order_id, id) DO UPDATE SET
              ingredient_id = excluded.ingredient_id,
              purchase_quantity = excluded.purchase_quantity,
              received_quantity = excluded.received_quantity,
              factor = excluded.factor
          `);
        }
      }
    });
  }

  override async confirm(input: ConfirmPurchase): Promise<PurchaseReceipt> {
    const failAt = this.failAt;
    this.failAt = null;

    return this.inTenant(input.tenantId, async (tx) => {
      const existing = await this.readReceipt(
        tx,
        input.tenantId,
        input.receiptId,
      );

      if (existing) {
        return existing;
      }

      const received =
        input.purchaseOrderId === null
          ? { lines: this.directLines(input), order: null }
          : await this.orderLines(tx, input);
      const lines = received.lines;
      await this.insertReceipt(tx, input, lines);

      if (received.order) {
        await this.writeOrder(tx, input.tenantId, received.order);
      }

      let position = await this.nextPosition(tx);

      for (const [index, line] of lines.entries()) {
        if (failAt === index + 1) {
          throw new Error(RECEIPT_FAILED);
        }

        const holding = await this.holding(
          tx,
          input.tenantId,
          input.locationId,
          line.ingredientId,
        );
        const average = nextAverageCost({
          onHand: holding.quantity,
          averageCost: holding.averageCost,
          receivedQuantity: line.quantity,
          receiptCost: line.unitCost,
        });
        await this.insertMovement(tx, input, line, position);
        await this.addBalance(
          tx,
          input.tenantId,
          input.locationId,
          line.ingredientId,
          line.quantity,
          average,
        );
        position += 1;
      }

      return {
        receiptId: input.receiptId,
        tenantId: input.tenantId,
        locationId: input.locationId,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
        purchaseOrderId: input.purchaseOrderId,
        lines,
      };
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

  async purchaseMovements(tenantId: string): Promise<
    readonly {
      id: string;
      tenantId: string;
      locationId: string;
      ingredientId: string;
      quantity: number;
      unitCost: number;
      type: typeof MOVEMENT_TYPE.PURCHASE;
      reference: string;
      occurredAt: string;
      actorId: string;
      orderLineId: null;
      role: null;
      recipeVersion: null;
    }[]
  > {
    return this.inTenant(tenantId, async (tx) => {
      const selected = rowsOf<MovementRow>(
        await tx.execute(sql`
          SELECT
            id,
            location_id,
            ingredient_id,
            quantity,
            unit_cost,
            reference,
            occurred_at,
            actor_id,
            order_line_id,
            role,
            recipe_version
          FROM stock_movements
          WHERE tenant_id = ${tenantId}
            AND movement_type = ${MOVEMENT_TYPE.PURCHASE}
          ORDER BY position
        `),
      );

      return selected.map((row) => ({
        id: row.id,
        tenantId,
        locationId: row.location_id,
        ingredientId: row.ingredient_id,
        quantity: asNumber(row.quantity),
        unitCost: asNumber(row.unit_cost),
        type: MOVEMENT_TYPE.PURCHASE,
        reference: row.reference,
        occurredAt: row.occurred_at,
        actorId: row.actor_id,
        orderLineId: null,
        role: null,
        recipeVersion: null,
      }));
    });
  }

  async storedReceipts(tenantId: string): Promise<readonly PurchaseReceipt[]> {
    return this.inTenant(tenantId, async (tx) => {
      const receipts = rowsOf<ReceiptRow>(
        await tx.execute(sql`
          SELECT id, location_id, actor_id, occurred_at, purchase_order_id
          FROM purchase_receipts
          WHERE tenant_id = ${tenantId}
          ORDER BY occurred_at, id
        `),
      );
      const lines = rowsOf<ReceiptLineRow>(
        await tx.execute(sql`
          SELECT
            receipt_id,
            position,
            ingredient_id,
            purchase_quantity,
            purchase_unit_cost,
            factor,
            quantity,
            unit_cost
          FROM purchase_receipt_lines
          WHERE tenant_id = ${tenantId}
          ORDER BY receipt_id, position
        `),
      );

      return receipts.map((receipt) => ({
        receiptId: receipt.id,
        tenantId,
        locationId: receipt.location_id,
        actorId: receipt.actor_id,
        occurredAt: receipt.occurred_at,
        purchaseOrderId: receipt.purchase_order_id,
        lines: lines
          .filter((line) => line.receipt_id === receipt.id)
          .map((line) => ({
            ingredientId: line.ingredient_id,
            purchaseQuantity: asNumber(line.purchase_quantity),
            purchaseUnitCost: asNumber(line.purchase_unit_cost),
            factor: asNumber(line.factor),
            quantity: asNumber(line.quantity),
            unitCost: asNumber(line.unit_cost),
          })),
      }));
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

  private directLines(input: ConfirmPurchase): PurchaseReceiptLine[] {
    if (input.receiptId.length === 0 || input.lines.length === 0) {
      throw new InvalidPurchase();
    }

    return input.lines.map((line) => {
      const converted = toBaseReceipt({
        purchaseQuantity: line.purchaseQuantity,
        purchaseUnitCost: line.purchaseUnitCost,
        factor: line.publishedFactor,
      });

      return {
        ingredientId: line.ingredientId,
        purchaseQuantity: converted.purchaseQuantity,
        purchaseUnitCost: converted.purchaseUnitCost,
        factor: converted.factor,
        quantity: converted.quantity,
        unitCost: converted.unitCost,
      };
    });
  }

  private async orderLines(
    tx: Transaction,
    input: ConfirmPurchase,
  ): Promise<{ lines: PurchaseReceiptLine[]; order: PurchaseOrder }> {
    const book = await this.readBook(tx, input.tenantId);
    const order = book?.orders.find(
      (item) => item.id === input.purchaseOrderId,
    );

    if (!order || order.locationId !== input.locationId) {
      throw new InvalidPurchase();
    }

    const lines = order
      .receive({
        receiptId: input.receiptId,
        lines: input.lines.map((line) => ({
          lineId: this.orderLineId(order, line.ingredientId),
          purchaseQuantity: line.purchaseQuantity,
          purchaseUnitCost: line.purchaseUnitCost,
        })),
      })
      .map((line) => ({
        ingredientId: line.ingredientId,
        purchaseQuantity: line.purchaseQuantity,
        purchaseUnitCost: line.purchaseUnitCost,
        factor: line.factor,
        quantity: line.quantity,
        unitCost: line.unitCost,
      }));

    return { lines, order };
  }

  private async writeOrder(
    tx: Transaction,
    tenantId: string,
    order: PurchaseOrder,
  ): Promise<void> {
    await tx.execute(sql`
      UPDATE purchase_orders
      SET status = ${order.status}
      WHERE tenant_id = ${tenantId}
        AND id = ${order.id}
    `);

    for (const line of order.lines) {
      await tx.execute(sql`
        UPDATE purchase_order_lines
        SET received_quantity = ${line.receivedQuantity}
        WHERE tenant_id = ${tenantId}
          AND order_id = ${order.id}
          AND id = ${line.id}
      `);
    }
  }

  private async insertReceipt(
    tx: Transaction,
    input: ConfirmPurchase,
    lines: readonly PurchaseReceiptLine[],
  ): Promise<void> {
    await tx.execute(sql`
      INSERT INTO purchase_receipts (
        tenant_id,
        id,
        location_id,
        actor_id,
        occurred_at,
        purchase_order_id
      )
      VALUES (
        ${input.tenantId},
        ${input.receiptId},
        ${input.locationId},
        ${input.actorId},
        ${input.occurredAt},
        ${input.purchaseOrderId}
      )
    `);

    for (const [index, line] of lines.entries()) {
      await tx.execute(sql`
        INSERT INTO purchase_receipt_lines (
          tenant_id,
          receipt_id,
          position,
          ingredient_id,
          purchase_quantity,
          purchase_unit_cost,
          factor,
          quantity,
          unit_cost
        )
        VALUES (
          ${input.tenantId},
          ${input.receiptId},
          ${index + 1},
          ${line.ingredientId},
          ${line.purchaseQuantity},
          ${line.purchaseUnitCost},
          ${line.factor},
          ${line.quantity},
          ${line.unitCost}
        )
      `);
    }
  }

  private async insertMovement(
    tx: Transaction,
    input: ConfirmPurchase,
    line: PurchaseReceiptLine,
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
        ${input.tenantId},
        ${`movement_${input.receiptId}_${line.ingredientId}`},
        ${position},
        ${input.locationId},
        ${input.locationId},
        ${line.ingredientId},
        ${line.quantity},
        ${line.unitCost},
        ${MOVEMENT_TYPE.PURCHASE},
        ${input.receiptId},
        ${input.occurredAt},
        NULL,
        NULL,
        NULL,
        NULL,
        ${input.actorId},
        NULL
      )
    `);
  }

  private async addBalance(
    tx: Transaction,
    tenantId: string,
    locationId: string,
    ingredientId: string,
    quantity: number,
    averageCost: number,
  ): Promise<void> {
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
    const [row] = rowsOf<CountRow>(
      await tx.execute(sql`
        SELECT coalesce(max(position), 0) AS position
        FROM stock_movements
      `),
    );

    return asNumber(row?.position ?? 0) + 1;
  }

  private async readReceipt(
    tx: Transaction,
    tenantId: string,
    receiptId: string,
  ): Promise<PurchaseReceipt | null> {
    const [receipt] = rowsOf<ReceiptRow>(
      await tx.execute(sql`
        SELECT id, location_id, actor_id, occurred_at, purchase_order_id
        FROM purchase_receipts
        WHERE tenant_id = ${tenantId}
          AND id = ${receiptId}
      `),
    );

    if (!receipt) {
      return null;
    }

    const lines = rowsOf<ReceiptLineRow>(
      await tx.execute(sql`
        SELECT
          receipt_id,
          position,
          ingredient_id,
          purchase_quantity,
          purchase_unit_cost,
          factor,
          quantity,
          unit_cost
        FROM purchase_receipt_lines
        WHERE tenant_id = ${tenantId}
          AND receipt_id = ${receiptId}
        ORDER BY position
      `),
    );

    return {
      receiptId: receipt.id,
      tenantId,
      locationId: receipt.location_id,
      actorId: receipt.actor_id,
      occurredAt: receipt.occurred_at,
      purchaseOrderId: receipt.purchase_order_id,
      lines: lines.map((line) => ({
        ingredientId: line.ingredient_id,
        purchaseQuantity: asNumber(line.purchase_quantity),
        purchaseUnitCost: asNumber(line.purchase_unit_cost),
        factor: asNumber(line.factor),
        quantity: asNumber(line.quantity),
        unitCost: asNumber(line.unit_cost),
      })),
    };
  }

  private async readBook(
    tx: Transaction,
    tenantId: string,
  ): Promise<Purchasing | null> {
    const suppliers = rowsOf<SupplierRow>(
      await tx.execute(sql`
        SELECT id, identification, name, issues_e_invoices, lead_time_days
        FROM suppliers
        WHERE tenant_id = ${tenantId}
        ORDER BY id
      `),
    );
    const orders = rowsOf<OrderRow>(
      await tx.execute(sql`
        SELECT id, supplier_id, location_id, status
        FROM purchase_orders
        WHERE tenant_id = ${tenantId}
        ORDER BY id
      `),
    );
    const lines = rowsOf<OrderLineRow>(
      await tx.execute(sql`
        SELECT
          order_id,
          id,
          ingredient_id,
          purchase_quantity,
          received_quantity,
          factor
        FROM purchase_order_lines
        WHERE tenant_id = ${tenantId}
        ORDER BY order_id, id
      `),
    );

    if (suppliers.length === 0 && orders.length === 0) {
      return null;
    }

    const book = Purchasing.open({ tenantId });

    for (const supplier of suppliers) {
      book.registerSupplier({
        id: supplier.id,
        identification: supplier.identification,
        name: supplier.name,
        issuesEInvoices: supplier.issues_e_invoices,
        leadTimeDays: asNumber(supplier.lead_time_days),
      });
    }

    for (const order of orders) {
      const opened = book.openOrder({
        id: order.id,
        supplierId: order.supplier_id,
        locationId: order.location_id,
        lines: lines
          .filter((line) => line.order_id === order.id)
          .map((line) => ({
            id: line.id,
            ingredientId: line.ingredient_id,
            purchaseQuantity: asNumber(line.purchase_quantity),
            factor: asNumber(line.factor),
          })),
      });
      const received = lines.filter(
        (line) =>
          line.order_id === order.id && asNumber(line.received_quantity) > 0,
      );

      if (received.length > 0) {
        opened.receive({
          receiptId: `stored_${order.id}`,
          lines: received.map((line) => ({
            lineId: line.id,
            purchaseQuantity: asNumber(line.received_quantity),
            purchaseUnitCost: 0,
          })),
        });
      }

      if (order.status === PURCHASE_ORDER_STATUS.CANCELLED) {
        opened.cancel();
      }
    }

    return book;
  }

  private orderLineId(order: PurchaseOrder, ingredientId: string): string {
    const found = order.lines.filter(
      (line) => line.ingredientId === ingredientId,
    );
    const line = found[0];

    if (found.length !== 1 || !line) {
      throw new InvalidPurchase();
    }

    return line.id;
  }
}
