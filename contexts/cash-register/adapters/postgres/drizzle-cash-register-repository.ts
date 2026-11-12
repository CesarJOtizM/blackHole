import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { cashMovements, cashShifts } from "#adapters/postgres/schema.js";
import { CashRegisterRepository } from "#application/ports/cash-register-repository.js";
import {
  type CashMovementKind,
  CashShift,
  ShiftAlreadyOpen,
} from "#domain/cash-shift.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type CashShiftRow = typeof cashShifts.$inferSelect;
type CashMovementRow = typeof cashMovements.$inferSelect;

const MOVEMENT_KINDS = ["cash_in", "cash_out", "withdrawal"] as const;

const movementKind = (kind: string): CashMovementKind => {
  const match = MOVEMENT_KINDS.find((candidate) => candidate === kind);

  if (match === undefined) {
    throw new Error(`Unexpected cash movement kind: ${kind}`);
  }

  return match;
};

const isOpenShiftConflict = (error: unknown): boolean => {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const record = current as { message?: string; cause?: unknown };

    if (
      typeof record.message === "string" &&
      record.message.includes("cash_shifts_one_open")
    ) {
      return true;
    }

    current = record.cause;
  }

  return false;
};

const toShift = (
  row: CashShiftRow,
  movementRows: readonly CashMovementRow[],
): CashShift => {
  const shift = CashShift.forRegister(row.registerId);
  shift.open({
    id: row.id,
    cashierId: row.cashierId,
    openingFloatCop: row.openingFloatCop,
  });

  for (const movement of movementRows) {
    shift.recordMovement({
      id: movement.id,
      kind: movementKind(movement.kind),
      amountCop: movement.amountCop,
      reason: movement.reason,
    });
  }

  return shift;
};

export class DrizzleCashRegisterRepository extends CashRegisterRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async load(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<CashShift | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(cashShifts)
        .where(
          and(
            eq(cashShifts.venueId, venueId),
            eq(cashShifts.registerId, registerId),
          ),
        );
      const row =
        rows.find((candidate) => candidate.status === "open") ?? rows[0];

      if (row === undefined) {
        return null;
      }

      const movementRows = await tx
        .select()
        .from(cashMovements)
        .where(eq(cashMovements.shiftId, row.id))
        .orderBy(asc(cashMovements.position));

      return toShift(row, movementRows);
    });
  }

  async listOpen(
    tenantId: string,
    venueId: string,
  ): Promise<readonly CashShift[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(cashShifts)
        .where(
          and(eq(cashShifts.venueId, venueId), eq(cashShifts.status, "open")),
        );

      if (rows.some((row) => row.tenantId !== tenantId)) {
        throw new Error("Stored cash shift does not match the tenant.");
      }

      return rows.map((row) => toShift(row, []));
    });
  }

  override async save(
    tenantId: string,
    venueId: string,
    shift: CashShift,
  ): Promise<void> {
    const shiftId = shift.id;
    const cashierId = shift.cashierId;
    const openingFloatCop = shift.openingFloatCop;
    const status = shift.state;

    if (
      shiftId === undefined ||
      cashierId === undefined ||
      openingFloatCop === undefined ||
      status === undefined
    ) {
      throw new Error("A cash shift must be open before it is saved.");
    }

    const movements = shift.movements;

    await this.inTenant(tenantId, async (tx) => {
      const existing = await tx
        .select({ id: cashShifts.id })
        .from(cashShifts)
        .where(
          and(
            eq(cashShifts.venueId, venueId),
            eq(cashShifts.registerId, shift.registerId),
            inArray(cashShifts.status, ["open", "counting"]),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new ShiftAlreadyOpen();
      }

      try {
        await tx.insert(cashShifts).values({
          tenantId,
          id: shiftId,
          venueId,
          registerId: shift.registerId,
          cashierId,
          openingFloatCop,
          status,
        });

        if (movements.length === 0) {
          return;
        }

        await tx.insert(cashMovements).values(
          movements.map((movement, index) => ({
            tenantId,
            id: movement.id,
            shiftId,
            position: index + 1,
            kind: movement.kind,
            amountCop: movement.amountCop,
            reason: movement.reason,
          })),
        );
      } catch (error) {
        if (isOpenShiftConflict(error)) {
          throw new ShiftAlreadyOpen();
        }

        throw error;
      }
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE cash_register_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}
