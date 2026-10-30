import { expect, it } from "vitest";

import {
  AccountSplit,
  InvalidPartId,
  SplitImbalance,
} from "#domain/account-split.js";

const TABLE_ID = "dining_table_5";
const JOINED_TABLE_ID = "dining_table_6";
const PART_IDS = ["part_1", "part_2", "part_3"] as const;

const equalSplit = () =>
  AccountSplit.equal({
    accountCop: 100_000,
    originTableId: TABLE_ID,
    partIds: PART_IDS,
  });

const viewOf = (split: AccountSplit) => ({
  open: split.open,
  parts: split.parts,
});

it("given an account of 100000 split in 3, when the split is created, then parts are 33334, 33333 and 33333 and each copies originTableId", () => {
  const split = equalSplit();

  expect(viewOf(split)).toEqual({
    open: true,
    parts: [
      {
        id: "part_1",
        amountCop: 33_334,
        originTableId: TABLE_ID,
        paid: false,
        lines: [],
      },
      {
        id: "part_2",
        amountCop: 33_333,
        originTableId: TABLE_ID,
        paid: false,
        lines: [],
      },
      {
        id: "part_3",
        amountCop: 33_333,
        originTableId: TABLE_ID,
        paid: false,
        lines: [],
      },
    ],
  });
  expect(split.parts.reduce((total, part) => total + part.amountCop, 0)).toBe(
    100_000,
  );
});

it("given parts that do not add up to the account, when the split is submitted, then SplitImbalance and nothing is stored", () => {
  const stored: AccountSplit[] = [];

  const submit = () => {
    stored.push(
      AccountSplit.create({
        accountCop: 100_000,
        parts: [
          { id: "part_1", amountCop: 33_334, originTableId: TABLE_ID },
          { id: "part_2", amountCop: 33_333, originTableId: TABLE_ID },
          { id: "part_3", amountCop: 33_332, originTableId: TABLE_ID },
        ],
      }),
    );
  };

  expect(submit).toThrow(SplitImbalance);
  expect(stored).toEqual([]);
});

it("given a part id without the part_ prefix, when the split is submitted, then InvalidPartId and nothing is stored", () => {
  const stored: AccountSplit[] = [];

  const submit = () => {
    stored.push(
      AccountSplit.equal({
        accountCop: 100_000,
        originTableId: TABLE_ID,
        partIds: ["1", "part_2", "part_3"],
      }),
    );
  };

  expect(submit).toThrow(InvalidPartId);
  expect(stored).toEqual([]);
});

it("given a split account with one part paid, when viewed, then it stays open until all parts are paid", () => {
  const split = equalSplit();

  split.pay("part_1");

  expect(split.open).toBe(true);
  expect(split.parts.map((part) => part.paid)).toEqual([true, false, false]);

  split.pay("part_2");
  split.pay("part_3");

  expect(split.open).toBe(false);
});

it("given payable lines, when the account is split by products or diners, then each part copies originTableId and the order lines stay unchanged", () => {
  const lines = [
    { id: "line_1", amountCop: 60_000, originTableId: TABLE_ID },
    { id: "line_2", amountCop: 40_000, originTableId: JOINED_TABLE_ID },
  ];
  const before = lines.map((line) => ({ ...line }));

  const split = AccountSplit.assign({
    accountCop: 100_000,
    lines,
    parts: [
      { id: "part_1", lineIds: ["line_1"] },
      { id: "part_2", lineIds: ["line_2"] },
    ],
  });

  expect(lines).toEqual(before);
  expect(split.parts).toEqual([
    {
      id: "part_1",
      amountCop: 60_000,
      originTableId: TABLE_ID,
      paid: false,
      lines: [{ lineId: "line_1", amountCop: 60_000, originTableId: TABLE_ID }],
    },
    {
      id: "part_2",
      amountCop: 40_000,
      originTableId: JOINED_TABLE_ID,
      paid: false,
      lines: [
        {
          lineId: "line_2",
          amountCop: 40_000,
          originTableId: JOINED_TABLE_ID,
        },
      ],
    },
  ]);
  expect(split.open).toBe(true);
});
