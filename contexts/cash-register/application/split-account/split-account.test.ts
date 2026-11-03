import { expect, it, vi } from "vitest";

import { UnknownAccount } from "#application/charge-check/charge-check.js";
import type { AccountCheck } from "#application/ports/account-gateway.js";
import { AccountGateway } from "#application/ports/account-gateway.js";
import { AccountSplitStore } from "#application/ports/account-split-store.js";
import {
  type KnownRegister,
  RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { SplitAccount } from "#application/split-account/split-account.js";
import {
  type AccountSplit,
  InvalidPartId,
  SplitImbalance,
} from "#domain/account-split.js";

const TENANT_ID = "organization_tenant_1";
const OTHER_TENANT_ID = "organization_tenant_2";
const VENUE_ID = "organization_venue_1";
const REGISTER_ID = "organization_register_front";
const UNKNOWN_REGISTER_ID = "organization_register_missing";
const CHECK_ID = "orders_check_1";
const TABLE_ID = "orders_table_5";
const ORIGIN_TABLE_ID = "orders_table_origin";
const JOINED_TABLE_ID = "orders_table_6";
const LINE_ID = "orders_line_1";
const LINE_TWO_ID = "orders_line_2";
const PRODUCT_ID = "menu_product_1";
const PRODUCT_TWO_ID = "menu_product_2";
const MENU_CLASS = "food";
const PART_IDS = ["part_1", "part_2", "part_3"] as const;

const registerKey = (
  tenantId: string,
  venueId: string,
  registerId: string,
): string => `${tenantId}:${venueId}:${registerId}`;

const splitKey = (tenantId: string, venueId: string, checkId: string): string =>
  `${tenantId}:${venueId}:${checkId}`;

const accountKey = (
  tenantId: string,
  venueId: string,
  checkId: string,
): string => `${tenantId}:${venueId}:${checkId}`;

const accountOf = (accountCop: number): AccountCheck => ({
  checkId: CHECK_ID,
  tableId: TABLE_ID,
  accountCop,
  lines: [
    {
      lineId: LINE_ID,
      productId: PRODUCT_ID,
      priceCop: accountCop,
      originTableId: ORIGIN_TABLE_ID,
      menuClass: MENU_CLASS,
    },
  ],
});

const joinedAccount = (): AccountCheck => ({
  checkId: CHECK_ID,
  tableId: TABLE_ID,
  accountCop: 100_000,
  lines: [
    {
      lineId: LINE_ID,
      productId: PRODUCT_ID,
      priceCop: 60_000,
      originTableId: ORIGIN_TABLE_ID,
      menuClass: MENU_CLASS,
    },
    {
      lineId: LINE_TWO_ID,
      productId: PRODUCT_TWO_ID,
      priceCop: 40_000,
      originTableId: JOINED_TABLE_ID,
      menuClass: MENU_CLASS,
    },
  ],
});

class MemoryAccounts extends AccountGateway {
  private readonly checks = new Map<string, AccountCheck>();

  constructor(tenantId: string, check: AccountCheck) {
    super();
    this.checks.set(accountKey(tenantId, VENUE_ID, check.checkId), check);
  }

  override async findCheck(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<AccountCheck | null> {
    return this.checks.get(accountKey(tenantId, venueId, checkId)) ?? null;
  }

  override async markPaid(
    _tenantId: string,
    _venueId: string,
    _checkId: string,
  ): Promise<void> {}
}

class MemoryRegisterLookup extends RegisterLookup {
  constructor(private readonly known: ReadonlySet<string>) {
    super();
  }

  override async find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<KnownRegister | null> {
    if (!this.known.has(registerKey(tenantId, venueId, registerId))) {
      return null;
    }

    return { id: registerId, venueId, drawer: "absent", printerId: null };
  }
}

class MemoryAccountSplits extends AccountSplitStore {
  private readonly splits = new Map<string, AccountSplit>();

  override async find(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<AccountSplit | null> {
    return this.splits.get(splitKey(tenantId, venueId, checkId)) ?? null;
  }

  override async save(
    tenantId: string,
    venueId: string,
    checkId: string,
    split: AccountSplit,
  ): Promise<void> {
    this.splits.set(splitKey(tenantId, venueId, checkId), split);
  }
}

const knownRegisters = new Set([
  registerKey(TENANT_ID, VENUE_ID, REGISTER_ID),
  registerKey(OTHER_TENANT_ID, VENUE_ID, REGISTER_ID),
]);

const splitFor = (check: AccountCheck) => {
  const accounts = new MemoryAccounts(TENANT_ID, check);
  const splits = new MemoryAccountSplits();
  const lookup = new MemoryRegisterLookup(knownRegisters);

  return {
    accounts,
    splits,
    check,
    split: new SplitAccount(lookup, accounts, splits),
  };
};

const scope = {
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  registerId: REGISTER_ID,
  checkId: CHECK_ID,
};

const equalInput = {
  ...scope,
  kind: "equal" as const,
  partIds: PART_IDS,
};

it("given an account of 100000 split in 3, when the split is created, then parts are 33334, 33333 and 33333 and each copies originTableId", async () => {
  const { accounts, splits, check, split } = splitFor(accountOf(100_000));
  const markPaid = vi.spyOn(accounts, "markPaid");
  const linesBefore = check.lines.map((line) => ({ ...line }));

  const created = await split.execute(equalInput);

  expect(created.open).toBe(true);
  expect(created.parts).toEqual([
    {
      id: "part_1",
      amountCop: 33_334,
      originTableId: ORIGIN_TABLE_ID,
      paid: false,
      lines: [],
    },
    {
      id: "part_2",
      amountCop: 33_333,
      originTableId: ORIGIN_TABLE_ID,
      paid: false,
      lines: [],
    },
    {
      id: "part_3",
      amountCop: 33_333,
      originTableId: ORIGIN_TABLE_ID,
      paid: false,
      lines: [],
    },
  ]);
  expect(created.parts.reduce((total, part) => total + part.amountCop, 0)).toBe(
    100_000,
  );
  expect(created.parts.every((part) => part.id.startsWith("part_"))).toBe(true);
  expect(check.lines).toEqual(linesBefore);
  expect(markPaid).not.toHaveBeenCalled();
  const stored = await splits.find(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.parts).toEqual(created.parts);
  expect(stored?.open).toBe(true);
});

it("given payable lines, when the account is split by products, then each part copies originTableId and the order lines stay unchanged", async () => {
  const { accounts, splits, check, split } = splitFor(joinedAccount());
  const markPaid = vi.spyOn(accounts, "markPaid");
  const linesBefore = check.lines.map((line) => ({ ...line }));

  const created = await split.execute({
    ...scope,
    kind: "lines",
    parts: [
      { id: "part_1", lineIds: [LINE_ID] },
      { id: "part_2", lineIds: [LINE_TWO_ID] },
    ],
  });

  expect(check.lines).toEqual(linesBefore);
  expect(created.open).toBe(true);
  expect(created.parts).toEqual([
    {
      id: "part_1",
      amountCop: 60_000,
      originTableId: ORIGIN_TABLE_ID,
      paid: false,
      lines: [
        {
          lineId: LINE_ID,
          amountCop: 60_000,
          originTableId: ORIGIN_TABLE_ID,
        },
      ],
    },
    {
      id: "part_2",
      amountCop: 40_000,
      originTableId: JOINED_TABLE_ID,
      paid: false,
      lines: [
        {
          lineId: LINE_TWO_ID,
          amountCop: 40_000,
          originTableId: JOINED_TABLE_ID,
        },
      ],
    },
  ]);
  expect(markPaid).not.toHaveBeenCalled();
  const stored = await splits.find(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(stored?.parts).toEqual(created.parts);
});

it("given parts that do not add up to the account, when the split is submitted, then SplitImbalance and nothing is stored", async () => {
  const { accounts, splits, split } = splitFor(accountOf(100_000));
  const markPaid = vi.spyOn(accounts, "markPaid");
  const save = vi.spyOn(splits, "save");

  const submit = split.execute({
    ...scope,
    kind: "amounts",
    parts: [
      { id: "part_1", amountCop: 33_334 },
      { id: "part_2", amountCop: 33_333 },
      { id: "part_3", amountCop: 33_332 },
    ],
  });

  await expect(submit).rejects.toThrow(SplitImbalance);
  expect(save).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
  expect(await splits.find(TENANT_ID, VENUE_ID, CHECK_ID)).toBeNull();
});

it("given a part id without the part_ prefix, when the split is submitted, then InvalidPartId and nothing is stored", async () => {
  const { splits, split } = splitFor(accountOf(100_000));
  const save = vi.spyOn(splits, "save");

  const submit = split.execute({
    ...scope,
    kind: "equal",
    partIds: ["1", "part_2", "part_3"],
  });

  await expect(submit).rejects.toThrow(InvalidPartId);
  expect(save).not.toHaveBeenCalled();
  expect(await splits.find(TENANT_ID, VENUE_ID, CHECK_ID)).toBeNull();
});

it("given a split account with one part paid, when viewed, then it stays open until all parts are paid", async () => {
  const { splits, split } = splitFor(accountOf(100_000));

  await split.execute(equalInput);
  const afterOne = await split.pay({ ...scope, partId: "part_1" });

  expect(afterOne.open).toBe(true);
  expect(afterOne.parts.map((part) => part.paid)).toEqual([true, false, false]);
  const viewed = await splits.find(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(viewed?.open).toBe(true);
  expect(viewed?.parts.map((part) => part.paid)).toEqual([true, false, false]);

  await split.pay({ ...scope, partId: "part_2" });
  await split.pay({ ...scope, partId: "part_3" });

  const closed = await splits.find(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(closed?.open).toBe(false);
  expect(closed?.parts.every((part) => part.paid)).toBe(true);
});

it("given an unknown register, when the account is split, then UnknownRegister and nothing is saved", async () => {
  const { accounts, splits, split } = splitFor(accountOf(100_000));
  const findCheck = vi.spyOn(accounts, "findCheck");
  const markPaid = vi.spyOn(accounts, "markPaid");
  const save = vi.spyOn(splits, "save");

  const submit = split.execute({
    ...equalInput,
    registerId: UNKNOWN_REGISTER_ID,
  });

  await expect(submit).rejects.toThrow(UnknownRegister);
  expect(findCheck).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
  expect(await splits.find(TENANT_ID, VENUE_ID, CHECK_ID)).toBeNull();
});

it("given an unknown account, when the account is split, then UnknownAccount and nothing is saved", async () => {
  const { accounts, splits, split } = splitFor(accountOf(100_000));
  const markPaid = vi.spyOn(accounts, "markPaid");
  const save = vi.spyOn(splits, "save");

  const submit = split.execute({
    ...equalInput,
    checkId: "orders_check_missing",
  });

  await expect(submit).rejects.toThrow(UnknownAccount);
  expect(save).not.toHaveBeenCalled();
  expect(markPaid).not.toHaveBeenCalled();
  expect(
    await splits.find(TENANT_ID, VENUE_ID, "orders_check_missing"),
  ).toBeNull();
});

it("given a split saved for one tenant, when another tenant loads that account, then the split is absent", async () => {
  const { splits, split } = splitFor(accountOf(100_000));

  await split.execute(equalInput);

  const otherTenant = await splits.find(OTHER_TENANT_ID, VENUE_ID, CHECK_ID);
  const sameTenant = await splits.find(TENANT_ID, VENUE_ID, CHECK_ID);
  expect(otherTenant).toBeNull();
  expect(sameTenant?.open).toBe(true);
  expect(sameTenant?.parts.map((part) => part.amountCop)).toEqual([
    33_334, 33_333, 33_333,
  ]);
});
