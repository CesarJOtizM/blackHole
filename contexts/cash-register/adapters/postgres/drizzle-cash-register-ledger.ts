import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  accountParts,
  cashCounts,
  saleClosures,
} from "#adapters/postgres/schema.js";
import type { AccountPart } from "#domain/account-split.js";
import type { CountState } from "#domain/cash-count.js";
import type { PaymentTender, PaymentTip } from "#domain/payment.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface InsertPart {
  tenantId: string;
  venueId: string;
  checkId: string;
  part: AccountPart;
}

interface InsertCashCount {
  tenantId: string;
  venueId: string;
  registerId: string;
  id: string;
  countedBy: string;
  status: CountState;
  expectedCashCop?: number;
  countedCashCop?: number;
  denominations: readonly { denomination: number; quantity: number }[];
  terminals: readonly { terminalId: string; differenceCop: number }[];
}

interface SaleClosureLine {
  lineId: string;
  productId: string;
  priceCop: number;
  originTableId: string;
  menuClass: string;
}

interface InsertSaleClosure {
  tenantId: string;
  venueId: string;
  closure: {
    id: string;
    status: "queued";
    commandId: string;
    checkId: string;
    tableId: string;
    registerId: string;
    paymentId: string;
    saleCop: number;
    changeCop: number;
    lines: readonly SaleClosureLine[];
    tenders: readonly PaymentTender[];
    tip: PaymentTip;
  };
}

interface CashierCountRead {
  id: string;
  countedBy: string;
  status: CountState;
  countedCashCop: number | null;
  denominations: { denomination: number; quantity: number }[];
  terminals: { terminalId: string; differenceCop: number }[];
}

interface LoadedSaleClosure {
  id: string;
  status: "queued";
  commandId: string;
  checkId: string;
  tableId: string;
  registerId: string;
  paymentId: string;
  saleCop: number;
  changeCop: number;
  lines: SaleClosureLine[];
  tenders: PaymentTender[];
  tip: PaymentTip;
}

const jsonValue = <T>(value: T | string): T => {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value;
};

export class DrizzleCashRegisterLedger {
  private readonly database: Database;

  constructor(client: PGlite) {
    this.database = drizzle({ client });
  }

  async insertPart(input: InsertPart): Promise<void> {
    const { part } = input;

    await this.inTenant(input.tenantId, async (tx) => {
      await tx.insert(accountParts).values({
        tenantId: input.tenantId,
        id: part.id,
        venueId: input.venueId,
        checkId: input.checkId,
        originTableId: part.originTableId,
        amountCop: part.amountCop,
        paid: part.paid,
        lines: part.lines.map((line) => ({
          lineId: line.lineId,
          amountCop: line.amountCop,
          originTableId: line.originTableId,
        })),
      });
    });
  }

  async loadParts(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<AccountPart[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(accountParts)
        .where(
          and(
            eq(accountParts.venueId, venueId),
            eq(accountParts.checkId, checkId),
          ),
        )
        .orderBy(asc(accountParts.id));

      return rows.map((row) => ({
        id: row.id,
        amountCop: row.amountCop,
        originTableId: row.originTableId,
        paid: row.paid,
        lines: jsonValue(row.lines).map((line) => ({
          lineId: line.lineId,
          amountCop: line.amountCop,
          originTableId: line.originTableId,
        })),
      }));
    });
  }

  async insertCount(input: InsertCashCount): Promise<void> {
    await this.inTenant(input.tenantId, async (tx) => {
      await tx.insert(cashCounts).values({
        tenantId: input.tenantId,
        id: input.id,
        venueId: input.venueId,
        registerId: input.registerId,
        countedBy: input.countedBy,
        status: input.status,
        expectedCashCop: input.expectedCashCop ?? null,
        countedCashCop: input.countedCashCop ?? null,
        denominations: input.denominations.map((line) => ({
          denomination: line.denomination,
          quantity: line.quantity,
        })),
        terminals: input.terminals.map((terminal) => ({
          terminalId: terminal.terminalId,
          differenceCop: terminal.differenceCop,
        })),
      });
    });
  }

  async readCount(
    tenantId: string,
    venueId: string,
    registerId: string,
    countId: string,
  ): Promise<CashierCountRead | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: cashCounts.id,
          countedBy: cashCounts.countedBy,
          status: cashCounts.status,
          countedCashCop: cashCounts.countedCashCop,
          denominations: cashCounts.denominations,
          terminals: cashCounts.terminals,
        })
        .from(cashCounts)
        .where(
          and(
            eq(cashCounts.venueId, venueId),
            eq(cashCounts.registerId, registerId),
            eq(cashCounts.id, countId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return {
        id: row.id,
        countedBy: row.countedBy,
        status: row.status,
        countedCashCop: row.countedCashCop,
        denominations: jsonValue(row.denominations).map((line) => ({
          denomination: line.denomination,
          quantity: line.quantity,
        })),
        terminals: jsonValue(row.terminals).map((terminal) => ({
          terminalId: terminal.terminalId,
          differenceCop: terminal.differenceCop,
        })),
      };
    });
  }

  async insertClosure(input: InsertSaleClosure): Promise<void> {
    const { closure } = input;

    await this.inTenant(input.tenantId, async (tx) => {
      await tx
        .insert(saleClosures)
        .values({
          tenantId: input.tenantId,
          id: closure.id,
          venueId: input.venueId,
          checkId: closure.checkId,
          tableId: closure.tableId,
          registerId: closure.registerId,
          commandId: closure.commandId,
          paymentId: closure.paymentId,
          status: closure.status,
          saleCop: closure.saleCop,
          changeCop: closure.changeCop,
          lines: closure.lines.map((line) => ({
            lineId: line.lineId,
            productId: line.productId,
            priceCop: line.priceCop,
            originTableId: line.originTableId,
            menuClass: line.menuClass,
          })),
          tenders: closure.tenders.map((tender) => ({ ...tender })),
          tip: { ...closure.tip },
        })
        .onConflictDoNothing();
    });
  }

  async loadClosure(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<LoadedSaleClosure | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(saleClosures)
        .where(
          and(
            eq(saleClosures.venueId, venueId),
            eq(saleClosures.checkId, checkId),
          ),
        )
        .limit(1);
      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return {
        id: row.id,
        status: row.status,
        commandId: row.commandId,
        checkId: row.checkId,
        tableId: row.tableId,
        registerId: row.registerId,
        paymentId: row.paymentId,
        saleCop: row.saleCop,
        changeCop: row.changeCop,
        lines: jsonValue(row.lines).map((line) => ({
          lineId: line.lineId,
          productId: line.productId,
          priceCop: line.priceCop,
          originTableId: line.originTableId,
          menuClass: line.menuClass,
        })),
        tenders: jsonValue(row.tenders).map((tender) => ({ ...tender })),
        tip: { ...jsonValue(row.tip) },
      };
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
