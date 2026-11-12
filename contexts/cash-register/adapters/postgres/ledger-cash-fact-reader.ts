import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  cashCounts,
  payments,
  saleClosures,
  tipSettlements,
} from "#adapters/postgres/schema.js";
import {
  CashFactReader,
  type ListCashFactsCommand,
  type StoredCount,
  type StoredMethod,
  type StoredSettlement,
  type StoredTender,
  type StoredTip,
} from "#application/list-cash-facts/list-cash-facts.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const METHODS = [
  "cash",
  "card",
  "transfer",
  "wallet",
  "voucher",
  "customer_credit",
  "corporate_credit",
  "qr",
] as const;

interface StoredAmount {
  method: string;
  amountCop: number;
}

interface LedgerPayment {
  shiftId: string;
  recordedAt: string;
  tenders: StoredAmount[];
  tip: StoredAmount;
  checkId: string | null;
  registerId: string | null;
}

interface LedgerCount {
  registerId: string;
  expectedCashCop: number | null;
  countedCashCop: number | null;
}

const jsonValue = <T>(value: T | string): T => {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  return value;
};

const methodOf = (value: string): StoredMethod => {
  const match = METHODS.find((method) => method === value);

  if (match === undefined) {
    throw new Error(`Unexpected payment method: ${value}`);
  }

  return match;
};

const latestFor = (
  rows: readonly LedgerPayment[],
  registerId: string,
): LedgerPayment | null => {
  let latest: LedgerPayment | null = null;

  for (const row of rows) {
    if (row.registerId !== registerId) {
      continue;
    }

    if (latest === null || row.recordedAt > latest.recordedAt) {
      latest = row;
    }
  }

  return latest;
};

const tendersOf = (row: LedgerPayment): StoredTender[] => {
  if (row.checkId === null) {
    return [];
  }

  const checkId = row.checkId;
  let tipUsed = false;

  return row.tenders.map((tender) => {
    const method = methodOf(tender.method);
    const carriesTip = !tipUsed && method === methodOf(row.tip.method);
    if (carriesTip) {
      tipUsed = true;
    }

    return {
      checkId,
      waiterId: null,
      method,
      amountCop: tender.amountCop,
      tipCop: carriesTip ? row.tip.amountCop : 0,
      recordedAt: row.recordedAt,
    };
  });
};

export class LedgerCashFactReader extends CashFactReader {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async listTenders(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredTender[]> {
    const rows = await this.payments(command);

    return rows.flatMap((row) => tendersOf(row));
  }

  override async listTips(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredTip[]> {
    const rows = await this.payments(command);

    return rows.map((row) => ({
      waiterId: null,
      method: methodOf(row.tip.method),
      tipCop: row.tip.amountCop,
      recordedAt: row.recordedAt,
    }));
  }

  override async listSettlements(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredSettlement[]> {
    const [rows, payments] = await Promise.all([
      this.settlementRows(command),
      this.payments(command),
    ]);
    const recordedAt = payments.reduce<string | null>(
      (latest, row) =>
        latest === null || row.recordedAt > latest ? row.recordedAt : latest,
      null,
    );

    if (recordedAt === null) {
      return [];
    }

    return rows.map((row) => ({
      settlementId: row.id,
      poolCop: row.poolCop,
      recordedAt,
    }));
  }

  override async listCounts(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredCount[]> {
    const [counts, payments] = await Promise.all([
      this.countRows(command),
      this.payments(command),
    ]);

    return counts.flatMap((count) => {
      if (count.expectedCashCop === null || count.countedCashCop === null) {
        return [];
      }

      const payment = latestFor(payments, count.registerId);

      if (payment === null) {
        return [];
      }

      return [
        {
          shiftId: payment.shiftId,
          method: "cash",
          expectedCop: count.expectedCashCop,
          countedCop: count.countedCashCop,
          recordedAt: payment.recordedAt,
        },
      ];
    });
  }

  private payments(command: ListCashFactsCommand): Promise<LedgerPayment[]> {
    return this.inTenant(command.tenantId, async (tx) => {
      const rows = await tx
        .select({
          shiftId: payments.shiftId,
          recordedAt: payments.recordedAt,
          tenders: payments.tenders,
          tip: payments.tip,
          checkId: saleClosures.checkId,
          registerId: saleClosures.registerId,
        })
        .from(payments)
        .leftJoin(
          saleClosures,
          and(
            eq(saleClosures.tenantId, payments.tenantId),
            eq(saleClosures.paymentId, payments.id),
          ),
        )
        .where(eq(payments.venueId, command.venueId))
        .orderBy(asc(payments.id));

      return rows.map((row) => ({
        shiftId: row.shiftId,
        recordedAt: row.recordedAt,
        tenders: jsonValue(row.tenders).map((tender) => ({
          method: tender.method,
          amountCop: tender.amountCop,
        })),
        tip: {
          method: jsonValue(row.tip).method,
          amountCop: jsonValue(row.tip).amountCop,
        },
        checkId: row.checkId,
        registerId: row.registerId,
      }));
    });
  }

  private settlementRows(
    command: ListCashFactsCommand,
  ): Promise<readonly { id: string; poolCop: number }[]> {
    return this.inTenant(command.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: tipSettlements.id,
          poolCop: tipSettlements.poolCop,
        })
        .from(tipSettlements)
        .where(eq(tipSettlements.venueId, command.venueId))
        .orderBy(asc(tipSettlements.id));

      return rows;
    });
  }

  private countRows(command: ListCashFactsCommand): Promise<LedgerCount[]> {
    return this.inTenant(command.tenantId, async (tx) => {
      const rows = await tx
        .select({
          registerId: cashCounts.registerId,
          expectedCashCop: cashCounts.expectedCashCop,
          countedCashCop: cashCounts.countedCashCop,
        })
        .from(cashCounts)
        .where(eq(cashCounts.venueId, command.venueId))
        .orderBy(asc(cashCounts.id));

      return rows;
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
