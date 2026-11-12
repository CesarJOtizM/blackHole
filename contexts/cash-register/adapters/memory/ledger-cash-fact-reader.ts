import {
  CashFactReader,
  type ListCashFactsCommand,
  type StoredCount,
  type StoredMethod,
  type StoredSettlement,
  type StoredTender,
  type StoredTip,
} from "#application/list-cash-facts/list-cash-facts.js";

export interface LedgerCharge {
  checkId: string;
  registerId: string;
  tenders: readonly { method: StoredMethod; amountCop: number }[];
  tip: { method: StoredMethod; amountCop: number };
  recordedAt: string;
}

export interface LedgerSettlement {
  id: string;
  poolCop: number;
}

export interface LedgerCount {
  registerId: string;
  expectedCop: number | null;
  countedCop: number | null;
}

export interface CloudCashLedger {
  listCharges(
    tenantId: string,
    venueId: string,
  ): Promise<readonly LedgerCharge[]>;

  listSettlements(
    tenantId: string,
    venueId: string,
  ): Promise<readonly LedgerSettlement[]>;

  listCounts(
    tenantId: string,
    venueId: string,
  ): Promise<readonly LedgerCount[]>;
}

const latestCharge = (
  charges: readonly LedgerCharge[],
  registerId: string,
): LedgerCharge | null => {
  let latest: LedgerCharge | null = null;

  for (const charge of charges) {
    if (charge.registerId !== registerId) {
      continue;
    }

    if (latest === null || charge.recordedAt > latest.recordedAt) {
      latest = charge;
    }
  }

  return latest;
};

const tendersOf = (charge: LedgerCharge): StoredTender[] => {
  let tipUsed = false;

  return charge.tenders.map((tender) => {
    const carriesTip = !tipUsed && tender.method === charge.tip.method;
    if (carriesTip) {
      tipUsed = true;
    }

    return {
      checkId: charge.checkId,
      waiterId: null,
      method: tender.method,
      amountCop: tender.amountCop,
      tipCop: carriesTip ? charge.tip.amountCop : 0,
      recordedAt: charge.recordedAt,
    };
  });
};

export class MemoryLedgerCashFacts extends CashFactReader {
  constructor(private readonly ledger: CloudCashLedger) {
    super();
  }

  override async listTenders(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredTender[]> {
    const charges = await this.ledger.listCharges(
      command.tenantId,
      command.venueId,
    );

    return charges.flatMap((charge) => tendersOf(charge));
  }

  override async listTips(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredTip[]> {
    const charges = await this.ledger.listCharges(
      command.tenantId,
      command.venueId,
    );

    return charges.map((charge) => ({
      waiterId: null,
      method: charge.tip.method,
      tipCop: charge.tip.amountCop,
      recordedAt: charge.recordedAt,
    }));
  }

  override async listSettlements(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredSettlement[]> {
    const [settlements, charges] = await Promise.all([
      this.ledger.listSettlements(command.tenantId, command.venueId),
      this.ledger.listCharges(command.tenantId, command.venueId),
    ]);
    const recordedAt = charges.reduce<string | null>(
      (latest, charge) =>
        latest === null || charge.recordedAt > latest
          ? charge.recordedAt
          : latest,
      null,
    );

    if (recordedAt === null) {
      return [];
    }

    return settlements.map((settlement) => ({
      settlementId: settlement.id,
      poolCop: settlement.poolCop,
      recordedAt,
    }));
  }

  override async listCounts(
    command: ListCashFactsCommand,
  ): Promise<readonly StoredCount[]> {
    const [counts, charges] = await Promise.all([
      this.ledger.listCounts(command.tenantId, command.venueId),
      this.ledger.listCharges(command.tenantId, command.venueId),
    ]);

    return counts.flatMap((count) => {
      if (count.expectedCop === null || count.countedCop === null) {
        return [];
      }

      const charge = latestCharge(charges, count.registerId);

      if (charge === null) {
        return [];
      }

      return [
        {
          shiftId: charge.registerId,
          method: "cash" as const,
          expectedCop: count.expectedCop,
          countedCop: count.countedCop,
          recordedAt: charge.recordedAt,
        },
      ];
    });
  }
}
