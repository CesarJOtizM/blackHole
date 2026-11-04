import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { CashMovementKind } from "#domain/cash-shift.js";
import type {
  PaymentMethod,
  PaymentTender,
  PaymentTip,
} from "#domain/payment.js";
import type { TipPeriodKind } from "#domain/tip-period.js";
import type { TipPercentage, TipRuleMode } from "#domain/tip-rule.js";
import type {
  TipSettlementMode,
  TipSettlementParticipant,
  TipSettlementPercentage,
  TipSettlementShare,
} from "#domain/tip-settlement.js";

type CashShiftStatus = "open" | "counting" | "closed";

interface StoredPaymentAmount {
  method: string;
  amountCop: number;
  terminal?: string;
  approvalNumber?: string;
  brand?: string;
  last4?: string;
}

export const cashShifts = pgTable(
  "cash_shifts",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    venueId: text("venue_id").notNull(),
    registerId: text("register_id").notNull(),
    cashierId: text("cashier_id").notNull(),
    openingFloatCop: integer("opening_float_cop").notNull(),
    status: text("status").$type<CashShiftStatus>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("cash_shifts_one_open")
      .on(table.tenantId, table.venueId, table.registerId)
      .where(sql`${table.status} in ('open', 'counting')`),
  ],
);

export const cashMovements = pgTable(
  "cash_movements",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    shiftId: text("shift_id").notNull(),
    position: integer("position").notNull(),
    kind: text("kind").$type<CashMovementKind>().notNull(),
    amountCop: integer("amount_cop").notNull(),
    reason: text("reason").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    unique("cash_movements_shift_position").on(
      table.tenantId,
      table.shiftId,
      table.position,
    ),
  ],
);

export const payments = pgTable(
  "payments",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    venueId: text("venue_id").notNull(),
    shiftId: text("shift_id").notNull(),
    saleCop: integer("sale_cop").notNull(),
    changeCop: integer("change_cop").notNull(),
    tenders: jsonb("tenders").$type<StoredPaymentAmount[]>().notNull(),
    tip: jsonb("tip").$type<StoredPaymentAmount>().notNull(),
    recordedAt: text("recorded_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);

type CashCountStatus = "open" | "counting" | "closed";

interface StoredPartLine {
  lineId: string;
  amountCop: number;
  originTableId: string;
}

interface StoredClosureLine {
  lineId: string;
  productId: string;
  priceCop: number;
  originTableId: string;
  menuClass: string;
}

interface StoredDenominationLine {
  denomination: number;
  quantity: number;
}

interface StoredTerminalDifference {
  terminalId: string;
  differenceCop: number;
}

export const accountParts = pgTable(
  "account_parts",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    venueId: text("venue_id").notNull(),
    checkId: text("check_id").notNull(),
    originTableId: text("origin_table_id").notNull(),
    amountCop: integer("amount_cop").notNull(),
    paid: boolean("paid").notNull(),
    lines: jsonb("lines").$type<StoredPartLine[]>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);

export const cashCounts = pgTable(
  "cash_counts",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    venueId: text("venue_id").notNull(),
    registerId: text("register_id").notNull(),
    countedBy: text("counted_by").notNull(),
    status: text("status").$type<CashCountStatus>().notNull(),
    expectedCashCop: integer("expected_cash_cop"),
    countedCashCop: integer("counted_cash_cop"),
    denominations: jsonb("denominations")
      .$type<StoredDenominationLine[]>()
      .notNull(),
    terminals: jsonb("terminals").$type<StoredTerminalDifference[]>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);

export const saleClosures = pgTable(
  "sale_closures",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    venueId: text("venue_id").notNull(),
    checkId: text("check_id").notNull(),
    tableId: text("table_id").notNull(),
    registerId: text("register_id").notNull(),
    commandId: text("command_id").notNull(),
    paymentId: text("payment_id").notNull(),
    status: text("status").$type<"queued">().notNull(),
    saleCop: integer("sale_cop").notNull(),
    changeCop: integer("change_cop").notNull(),
    lines: jsonb("lines").$type<StoredClosureLine[]>().notNull(),
    tenders: jsonb("tenders").$type<PaymentTender[]>().notNull(),
    tip: jsonb("tip").$type<PaymentTip>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    unique("sale_closures_one_check").on(
      table.tenantId,
      table.venueId,
      table.checkId,
    ),
  ],
);

interface StoredTipMethod {
  method: PaymentMethod;
  amountCop: number;
}

interface StoredTipEdit {
  userId: string;
  workedMinutes: number | null;
  reason: string;
  change: "add" | "remove";
}

export const tipRules = pgTable(
  "tip_rules",
  {
    tenantId: text("tenant_id").notNull(),
    venueId: text("venue_id").notNull(),
    period: text("period").$type<TipPeriodKind>().notNull(),
    mode: text("mode").$type<TipRuleMode>().notNull(),
    shares: jsonb("shares").$type<TipPercentage[]>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.venueId] })],
);

export const tipSettlements = pgTable(
  "tip_settlements",
  {
    tenantId: text("tenant_id").notNull(),
    id: text("id").notNull(),
    venueId: text("venue_id").notNull(),
    poolCop: integer("pool_cop").notNull(),
    residueCop: integer("residue_cop").notNull(),
    methods: jsonb("methods").$type<StoredTipMethod[]>().notNull(),
    participants: jsonb("participants")
      .$type<TipSettlementParticipant[]>()
      .notNull(),
    shares: jsonb("shares").$type<TipSettlementShare[]>().notNull(),
    rule: jsonb("rule")
      .$type<{
        mode: TipSettlementMode;
        shares: TipSettlementPercentage[];
      }>()
      .notNull(),
    edits: jsonb("edits").$type<StoredTipEdit[]>().notNull(),
    adjustsSettlementId: text("adjusts_settlement_id"),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);
