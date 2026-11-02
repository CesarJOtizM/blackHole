import { expect, it } from "vitest";
import {
  CountDocumentAcceptance,
  DOCUMENT_BALANCE_ALERT_AUDIENCES,
  DOCUMENT_BALANCE_COLOR,
  DOCUMENT_BALANCE_SCOPE,
  DocumentBalanceAlert,
  type DocumentBalanceAlertNotice,
  type DocumentBalanceKey,
  type DocumentBalanceScope,
  DocumentBalanceStore,
  type OpeningDocumentBalance,
  type ScopedAcceptanceCount,
  SetDocumentBalance,
} from "#application/document-balance/document-balance.js";

const COMPANY_ID = "company_1";
const NIT = "900123456";
const SITE_ID = "site_front";
const OTHER_SITE_ID = "site_bar";

const balanceKey = (key: DocumentBalanceKey): string =>
  `${key.companyId}|${key.nit}|${key.siteId}`;

const acceptanceKey = (scope: DocumentBalanceScope, scopeId: string): string =>
  `${scope}|${scopeId}`;

class MemoryDocumentBalances extends DocumentBalanceStore {
  readonly remaining = new Map<string, number>();
  readonly counts = new Map<string, number>();

  override async readRemaining(
    key: DocumentBalanceKey,
  ): Promise<number | null> {
    return this.remaining.get(balanceKey(key)) ?? null;
  }

  override async saveRemaining(balance: OpeningDocumentBalance): Promise<void> {
    this.remaining.set(balanceKey(balance), balance.remaining);
  }

  override async readCount(
    scope: DocumentBalanceScope,
    scopeId: string,
  ): Promise<number> {
    return this.counts.get(acceptanceKey(scope, scopeId)) ?? 0;
  }

  override async saveCount(count: ScopedAcceptanceCount): Promise<void> {
    this.counts.set(acceptanceKey(count.scope, count.scopeId), count.count);
  }
}

class MemoryBalanceAlerts extends DocumentBalanceAlert {
  readonly raised: DocumentBalanceAlertNotice[] = [];

  override async raise(alert: DocumentBalanceAlertNotice): Promise<void> {
    this.raised.push({
      ...alert,
      audiences: [...alert.audiences],
    });
  }
}

const harness = () => {
  const balances = new MemoryDocumentBalances();
  const alerts = new MemoryBalanceAlerts();
  const set = new SetDocumentBalance(balances);
  const count = new CountDocumentAcceptance(balances, alerts);

  return { balances, alerts, set, count };
};

const counted = async (input: { remaining: number; pace: number }) => {
  const { alerts, set, count } = harness();

  await set.execute({
    companyId: COMPANY_ID,
    nit: NIT,
    siteId: SITE_ID,
    remaining: input.remaining,
  });

  const result = await count.execute({
    companyId: COMPANY_ID,
    nit: NIT,
    siteId: SITE_ID,
    pace: input.pace,
  });

  return { alerts, result };
};

const alertFor = (color: DocumentBalanceAlertNotice["color"]) => ({
  companyId: COMPANY_ID,
  nit: NIT,
  siteId: SITE_ID,
  color,
  audiences: [...DOCUMENT_BALANCE_ALERT_AUDIENCES],
});

it("given acceptances for one company and one nit at two sites, when they are counted, then each adds one to the company, the nit, and its site", async () => {
  const { balances, set, count } = harness();
  await set.execute({
    companyId: COMPANY_ID,
    nit: NIT,
    siteId: SITE_ID,
    remaining: 30,
  });
  await set.execute({
    companyId: COMPANY_ID,
    nit: NIT,
    siteId: OTHER_SITE_ID,
    remaining: 30,
  });

  const first = await count.execute({
    companyId: COMPANY_ID,
    nit: NIT,
    siteId: SITE_ID,
    pace: 1,
  });
  const second = await count.execute({
    companyId: COMPANY_ID,
    nit: NIT,
    siteId: OTHER_SITE_ID,
    pace: 1,
  });

  expect(first.companyCount).toBe(1);
  expect(first.nitCount).toBe(1);
  expect(first.siteCount).toBe(1);
  expect(second.companyCount).toBe(2);
  expect(second.nitCount).toBe(2);
  expect(second.siteCount).toBe(1);
  expect(await balances.readCount(DOCUMENT_BALANCE_SCOPE.SITE, SITE_ID)).toBe(
    1,
  );
  expect(
    await balances.readCount(DOCUMENT_BALANCE_SCOPE.COMPANY, COMPANY_ID),
  ).toBe(2);
  expect(await balances.readCount(DOCUMENT_BALANCE_SCOPE.NIT, NIT)).toBe(2);
});

it("given an opening remaining, when SetDocumentBalance runs, then that remaining is stored and acceptance counts stay at zero", async () => {
  const { balances, set } = harness();

  const result = await set.execute({
    companyId: COMPANY_ID,
    nit: NIT,
    siteId: SITE_ID,
    remaining: 40,
  });

  expect(result).toEqual({
    companyId: COMPANY_ID,
    nit: NIT,
    siteId: SITE_ID,
    remaining: 40,
  });
  expect(
    await balances.readRemaining({
      companyId: COMPANY_ID,
      nit: NIT,
      siteId: SITE_ID,
    }),
  ).toBe(40);
  expect(
    await balances.readCount(DOCUMENT_BALANCE_SCOPE.COMPANY, COMPANY_ID),
  ).toBe(0);
  expect(await balances.readCount(DOCUMENT_BALANCE_SCOPE.NIT, NIT)).toBe(0);
  expect(await balances.readCount(DOCUMENT_BALANCE_SCOPE.SITE, SITE_ID)).toBe(
    0,
  );
});

it("given a remaining and a pace, when an acceptance is counted, then days equal remaining divided by pace", async () => {
  const { result } = await counted({ remaining: 9, pace: 2 });

  expect(result.days).toBe(4.5);
  expect(result.remaining).toBe(9);
});

it("given pace zero, when an acceptance is counted, then the balance has no color", async () => {
  const { alerts, result } = await counted({ remaining: 4, pace: 0 });

  expect(result.days).toBeNull();
  expect(result.color).toBe(DOCUMENT_BALANCE_COLOR.NONE);
  expect(result.companyCount).toBe(1);
  expect(result.nitCount).toBe(1);
  expect(result.siteCount).toBe(1);
  expect(alerts.raised).toEqual([]);
});

it("given the balance covers 12 days, when a document is counted, then a yellow alert reaches the company admin and support", async () => {
  const { alerts, result } = await counted({ remaining: 12, pace: 1 });

  expect(result.days).toBe(12);
  expect(result.color).toBe(DOCUMENT_BALANCE_COLOR.YELLOW);
  expect(alerts.raised).toEqual([alertFor(DOCUMENT_BALANCE_COLOR.YELLOW)]);
});

it("given the balance covers 5 days, when a document is counted, then the alert is yellow", async () => {
  const { alerts, result } = await counted({ remaining: 5, pace: 1 });

  expect(result.days).toBe(5);
  expect(result.color).toBe(DOCUMENT_BALANCE_COLOR.YELLOW);
  expect(alerts.raised).toEqual([alertFor(DOCUMENT_BALANCE_COLOR.YELLOW)]);
});

it("given the balance covers 15 days, when a document is counted, then there is no color", async () => {
  const { alerts, result } = await counted({ remaining: 15, pace: 1 });

  expect(result.days).toBe(15);
  expect(result.color).toBe(DOCUMENT_BALANCE_COLOR.NONE);
  expect(alerts.raised).toEqual([]);
});

it("given the balance covers fewer than 5 days, when a document is counted, then the alert is red", async () => {
  const { alerts, result } = await counted({ remaining: 4, pace: 1 });

  expect(result.days).toBe(4);
  expect(result.color).toBe(DOCUMENT_BALANCE_COLOR.RED);
  expect(alerts.raised).toEqual([alertFor(DOCUMENT_BALANCE_COLOR.RED)]);
});
