import type { PGlite } from "@electric-sql/pglite";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  accountParts,
  cashCounts,
  payments,
  saleClosures,
  tipRules,
  tipSettlements,
} from "#adapters/postgres/schema.js";
import type { ActiveTipRule } from "#application/configure-tip-rule/configure-tip-rule.js";
import type { RecordedPaymentTip } from "#application/ports/tip-pool.js";
import type { ClosedTipSettlement } from "#application/settle-tips/settle-tips.js";
import type { AccountPart } from "#domain/account-split.js";
import type { CountState } from "#domain/cash-count.js";
import type {
  PaymentMethod,
  PaymentTender,
  PaymentTip,
} from "#domain/payment.js";
import type { TipPeriodKind } from "#domain/tip-period.js";
import type { TipRuleMode } from "#domain/tip-rule.js";
import type { TipSettlementMode } from "#domain/tip-settlement.js";

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
  shiftId: string;
  recordedAt: string;
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

const PERIODS = ["shift", "day", "week"] as const;
const TIP_MODES = ["equal", "percentage", "hours"] as const;
const EDIT_CHANGES = ["add", "remove"] as const;
const PAYMENT_METHODS = [
  "cash",
  "card",
  "transfer",
  "wallet",
  "voucher",
  "customer_credit",
  "corporate_credit",
] as const;

const oneOf = <T extends string>(
  values: readonly T[],
  value: string,
  label: string,
): T => {
  const match = values.find((candidate) => candidate === value);

  if (match === undefined) {
    throw new Error(`Unexpected ${label}: ${value}`);
  }

  return match;
};

const tipPeriod = (value: string): TipPeriodKind =>
  oneOf(PERIODS, value, "tip period");

const tipMode = (value: string): TipRuleMode =>
  oneOf(TIP_MODES, value, "tip rule mode");

const settlementMode = (value: string): TipSettlementMode =>
  oneOf(TIP_MODES, value, "tip settlement mode");

const editChange = (value: string): "add" | "remove" =>
  oneOf(EDIT_CHANGES, value, "tip participant change");

const paymentMethod = (value: string): PaymentMethod =>
  oneOf(PAYMENT_METHODS, value, "payment method");

interface StoredTipAmount {
  method: string;
  amountCop: number;
  terminal?: string;
  approvalNumber?: string;
  brand?: string;
  last4?: string;
}

const recordedTip = (tip: StoredTipAmount): PaymentTip => {
  const method = paymentMethod(tip.method);

  if (method === "card") {
    if (
      tip.terminal === undefined ||
      tip.approvalNumber === undefined ||
      tip.brand === undefined ||
      tip.last4 === undefined
    ) {
      throw new Error("A stored card tip is missing its capture.");
    }

    return {
      method,
      amountCop: tip.amountCop,
      terminal: tip.terminal,
      approvalNumber: tip.approvalNumber,
      brand: tip.brand,
      last4: tip.last4,
    };
  }

  return {
    method,
    amountCop: tip.amountCop,
  };
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
      await tx
        .insert(payments)
        .values({
          tenantId: input.tenantId,
          id: closure.paymentId,
          venueId: input.venueId,
          shiftId: input.shiftId,
          saleCop: closure.saleCop,
          changeCop: closure.changeCop,
          tenders: closure.tenders.map((tender) => ({ ...tender })),
          tip: { ...closure.tip },
          recordedAt: input.recordedAt,
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

  async saveTipRule(input: {
    tenantId: string;
    venueId: string;
    rule: ActiveTipRule;
  }): Promise<void> {
    const shares = input.rule.shares.map((share) => ({
      employeeId: share.employeeId,
      percent: share.percent,
    }));

    await this.inTenant(input.tenantId, async (tx) => {
      await tx
        .insert(tipRules)
        .values({
          tenantId: input.tenantId,
          venueId: input.venueId,
          period: input.rule.period,
          mode: input.rule.mode,
          shares,
        })
        .onConflictDoUpdate({
          target: [tipRules.tenantId, tipRules.venueId],
          set: {
            period: input.rule.period,
            mode: input.rule.mode,
            shares,
          },
        });
    });
  }

  async findTipRule(
    tenantId: string,
    venueId: string,
  ): Promise<ActiveTipRule | null> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(tipRules)
        .where(eq(tipRules.venueId, venueId))
        .limit(1);
      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return {
        period: tipPeriod(row.period),
        mode: tipMode(row.mode),
        shares: jsonValue(row.shares).map((share) => ({
          employeeId: share.employeeId,
          percent: share.percent,
        })),
      };
    });
  }

  async appendTipSettlement(input: {
    tenantId: string;
    venueId: string;
    settlement: ClosedTipSettlement;
  }): Promise<void> {
    const { settlement } = input;

    await this.inTenant(input.tenantId, async (tx) => {
      await tx
        .insert(tipSettlements)
        .values({
          tenantId: input.tenantId,
          id: settlement.id,
          venueId: input.venueId,
          poolCop: settlement.poolCop,
          residueCop: settlement.residueCop,
          methods: settlement.methods.map((method) => ({
            method: method.method,
            amountCop: method.amountCop,
          })),
          participants: settlement.participants.map((participant) => ({
            userId: participant.userId,
            workedMinutes: participant.workedMinutes,
          })),
          shares: settlement.shares.map((share) => ({
            userId: share.userId,
            baseCop: share.baseCop,
            residueCop: share.residueCop,
          })),
          rule: {
            mode: settlement.rule.mode,
            shares: settlement.rule.shares.map((share) => ({
              employeeId: share.employeeId,
              percent: share.percent,
            })),
          },
          edits: settlement.edits.map((edit) => ({
            userId: edit.userId,
            workedMinutes: edit.workedMinutes,
            reason: edit.reason,
            change: edit.change,
          })),
          adjustsSettlementId: settlement.adjustsSettlementId,
        })
        .onConflictDoNothing();
    });
  }

  async listTipSettlements(
    tenantId: string,
    venueId: string,
  ): Promise<ClosedTipSettlement[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(tipSettlements)
        .where(eq(tipSettlements.venueId, venueId))
        .orderBy(asc(tipSettlements.id));

      return rows.map((row) => ({
        id: row.id,
        poolCop: row.poolCop,
        methods: jsonValue(row.methods).map((method) => ({
          method: paymentMethod(method.method),
          amountCop: method.amountCop,
        })),
        participants: jsonValue(row.participants).map((participant) => ({
          userId: participant.userId,
          workedMinutes: participant.workedMinutes,
        })),
        shares: jsonValue(row.shares).map((share) => ({
          userId: share.userId,
          baseCop: share.baseCop,
          residueCop: share.residueCop,
        })),
        residueCop: row.residueCop,
        rule: {
          mode: settlementMode(jsonValue(row.rule).mode),
          shares: jsonValue(row.rule).shares.map((share) => ({
            employeeId: share.employeeId,
            percent: share.percent,
          })),
        },
        adjustsSettlementId: row.adjustsSettlementId,
        edits: jsonValue(row.edits).map((edit) => ({
          userId: edit.userId,
          workedMinutes: edit.workedMinutes,
          reason: edit.reason,
          change: editChange(edit.change),
        })),
      }));
    });
  }

  async listPaymentTips(
    tenantId: string,
    venueId: string,
  ): Promise<RecordedPaymentTip[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select({
          recordedAt: payments.recordedAt,
          saleCop: payments.saleCop,
          tip: payments.tip,
        })
        .from(payments)
        .where(eq(payments.venueId, venueId))
        .orderBy(asc(payments.id));

      return rows.map((row) => ({
        recordedAt: row.recordedAt,
        tip: recordedTip(jsonValue(row.tip)),
        saleCop: row.saleCop,
        taxCop: 0,
      }));
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
