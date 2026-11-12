import { expect, it } from "vitest";
import { ListCashFacts as ListedOnEntryPort } from "#application/entry-port.js";
import {
  CashFactReader,
  type CountFact,
  ListCashFacts,
  type SettlementFact,
  type StoredCount,
  type StoredSettlement,
  type StoredTender,
  type StoredTip,
  type TenderFact,
  type TipFact,
} from "#application/list-cash-facts/list-cash-facts.js";

const FROM = "2026-11-04T05:00:00.000Z";
const TO = "2026-11-05T05:00:00.000Z";
const RECORDED_AT = "2026-11-04T18:21:00.000Z";
const OUTSIDE = "2026-11-03T18:21:00.000Z";

class MemoryCashFacts extends CashFactReader {
  override listTenders(): Promise<readonly StoredTender[]> {
    return Promise.resolve([
      {
        checkId: "check_5",
        waiterId: "user_waiter",
        method: "cash",
        amountCop: 85_000,
        tipCop: 5_000,
        recordedAt: RECORDED_AT,
      },
      {
        checkId: "check_qr",
        waiterId: null,
        method: "qr",
        amountCop: 12_000,
        tipCop: 0,
        recordedAt: RECORDED_AT,
      },
      {
        checkId: "check_old",
        waiterId: "user_waiter",
        method: "card",
        amountCop: 40_000,
        tipCop: 2_000,
        recordedAt: OUTSIDE,
      },
    ]);
  }

  override listTips(): Promise<readonly StoredTip[]> {
    return Promise.resolve([
      {
        waiterId: "user_waiter",
        method: "card",
        tipCop: 2_000,
        recordedAt: RECORDED_AT,
      },
      {
        waiterId: "user_waiter",
        method: "cash",
        tipCop: 9_000,
        recordedAt: OUTSIDE,
      },
    ]);
  }

  override listSettlements(): Promise<readonly StoredSettlement[]> {
    return Promise.resolve([
      {
        settlementId: "settlement_day",
        poolCop: 7_000,
        recordedAt: RECORDED_AT,
      },
      {
        settlementId: "settlement_old",
        poolCop: 1_000,
        recordedAt: OUTSIDE,
      },
    ]);
  }

  override listCounts(): Promise<readonly StoredCount[]> {
    return Promise.resolve([
      {
        shiftId: "shift_1",
        method: "cash",
        expectedCop: 100_000,
        countedCop: 97_000,
        recordedAt: RECORDED_AT,
      },
      {
        shiftId: "shift_old",
        method: "cash",
        expectedCop: 1,
        countedCop: 1,
        recordedAt: OUTSIDE,
      },
    ]);
  }
}

const period = {
  tenantId: "organization_tenant_1",
  venueId: "organization_venue_1",
  from: FROM,
  to: TO,
};

it("given the cash fact reader, when it is exported, then the entry port lists the same use case", () => {
  expect(ListedOnEntryPort).toBe(ListCashFacts);
});

it("given tenders, tips, a settlement, and a count, when cash facts are listed, then chargedAt is recorded_at and the difference is counted minus expected", async () => {
  const facts = await new ListCashFacts(new MemoryCashFacts()).execute(period);

  expect(facts.tenders).toEqual<TenderFact[]>([
    {
      checkId: "check_5",
      waiterId: "user_waiter",
      method: "cash",
      amountCop: 85_000,
      tipCop: 5_000,
      chargedAt: RECORDED_AT,
    },
  ]);
  expect(facts.tips).toEqual<TipFact[]>([
    {
      waiterId: "user_waiter",
      method: "card",
      tipCop: 2_000,
      chargedAt: RECORDED_AT,
    },
  ]);
  expect(facts.settlements).toEqual<SettlementFact[]>([
    {
      settlementId: "settlement_day",
      poolCop: 7_000,
      chargedAt: RECORDED_AT,
    },
  ]);
  expect(facts.counts).toEqual<CountFact[]>([
    {
      shiftId: "shift_1",
      method: "cash",
      expectedCop: 100_000,
      countedCop: 97_000,
      differenceCop: -3_000,
      chargedAt: RECORDED_AT,
    },
  ]);
});

it("given no rows in the period, when cash facts are listed, then every section stays empty", async () => {
  const facts = await new ListCashFacts(new MemoryCashFacts()).execute({
    ...period,
    from: "2026-12-01T05:00:00.000Z",
    to: "2026-12-02T05:00:00.000Z",
  });

  expect(facts).toEqual({
    tenders: [],
    tips: [],
    settlements: [],
    counts: [],
  });
});
