export type CashMethod =
  | "cash"
  | "card"
  | "transfer"
  | "wallet"
  | "voucher"
  | "customer_credit"
  | "corporate_credit";

export type StoredMethod = CashMethod | "qr";

export interface ListCashFactsCommand {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
}

export interface StoredTender {
  checkId: string;
  waiterId: string | null;
  method: StoredMethod;
  amountCop: number;
  tipCop: number;
  recordedAt: string;
}

export interface StoredTip {
  waiterId: string | null;
  method: StoredMethod;
  tipCop: number;
  recordedAt: string;
}

export interface StoredSettlement {
  settlementId: string;
  poolCop: number;
  recordedAt: string;
}

export interface StoredCount {
  shiftId: string;
  method: StoredMethod;
  expectedCop: number;
  countedCop: number;
  recordedAt: string;
}

export interface TenderFact {
  checkId: string;
  waiterId: string | null;
  method: CashMethod;
  amountCop: number;
  tipCop: number;
  chargedAt: string;
}

export interface TipFact {
  waiterId: string | null;
  method: CashMethod;
  tipCop: number;
  chargedAt: string;
}

export interface SettlementFact {
  settlementId: string;
  poolCop: number;
  chargedAt: string;
}

export interface CountFact {
  shiftId: string;
  method: CashMethod;
  expectedCop: number;
  countedCop: number;
  differenceCop: number;
  chargedAt: string;
}

export interface CashFacts {
  tenders: readonly TenderFact[];
  tips: readonly TipFact[];
  settlements: readonly SettlementFact[];
  counts: readonly CountFact[];
}

export abstract class CashFactReader {
  abstract listTenders(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredTender[]>;

  abstract listTips(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredTip[]>;

  abstract listSettlements(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredSettlement[]>;

  abstract listCounts(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredCount[]>;
}

const inPeriod = (recordedAt: string, from: string, to: string): boolean =>
  recordedAt >= from && recordedAt < to;

const reportedMethod = (method: StoredMethod): CashMethod | null =>
  method === "qr" ? null : method;

const byText = (left: string, right: string): number =>
  left.localeCompare(right);

export class ListCashFacts {
  constructor(private readonly facts: CashFactReader) {}

  async execute(command: ListCashFactsCommand): Promise<CashFacts> {
    const [tenders, tips, settlements, counts] = await Promise.all([
      this.facts.listTenders(command),
      this.facts.listTips(command),
      this.facts.listSettlements(command),
      this.facts.listCounts(command),
    ]);

    return {
      tenders: tenders
        .flatMap((row) => {
          const method = reportedMethod(row.method);

          if (
            method === null ||
            !inPeriod(row.recordedAt, command.from, command.to)
          ) {
            return [];
          }

          return [
            {
              checkId: row.checkId,
              waiterId: row.waiterId,
              method,
              amountCop: row.amountCop,
              tipCop: row.tipCop,
              chargedAt: row.recordedAt,
            },
          ];
        })
        .toSorted(
          (left, right) =>
            byText(left.checkId, right.checkId) ||
            byText(left.method, right.method),
        ),
      tips: tips
        .flatMap((row) => {
          const method = reportedMethod(row.method);

          if (
            method === null ||
            !inPeriod(row.recordedAt, command.from, command.to)
          ) {
            return [];
          }

          return [
            {
              waiterId: row.waiterId,
              method,
              tipCop: row.tipCop,
              chargedAt: row.recordedAt,
            },
          ];
        })
        .toSorted(
          (left, right) =>
            byText(left.method, right.method) ||
            byText(left.waiterId ?? "", right.waiterId ?? ""),
        ),
      settlements: settlements
        .flatMap((row) =>
          inPeriod(row.recordedAt, command.from, command.to)
            ? [
                {
                  settlementId: row.settlementId,
                  poolCop: row.poolCop,
                  chargedAt: row.recordedAt,
                },
              ]
            : [],
        )
        .toSorted((left, right) =>
          byText(left.settlementId, right.settlementId),
        ),
      counts: counts
        .flatMap((row) => {
          const method = reportedMethod(row.method);

          if (
            method === null ||
            !inPeriod(row.recordedAt, command.from, command.to)
          ) {
            return [];
          }

          return [
            {
              shiftId: row.shiftId,
              method,
              expectedCop: row.expectedCop,
              countedCop: row.countedCop,
              differenceCop: row.countedCop - row.expectedCop,
              chargedAt: row.recordedAt,
            },
          ];
        })
        .toSorted(
          (left, right) =>
            byText(left.shiftId, right.shiftId) ||
            byText(left.method, right.method),
        ),
    };
  }
}
