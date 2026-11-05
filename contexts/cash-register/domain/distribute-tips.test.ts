import { expect, it } from "vitest";

import {
  distributeTips,
  InvalidTipDistribution,
  type TipDistribution,
} from "#domain/distribute-tips.js";

const ANA = "user-ana";
const BEA = "user-bea";
const COCO = "user-coco";
const LUIS = "user-luis";
const MARIA = "user-maria";

function pesos(distribution: TipDistribution): number {
  const assigned = distribution.shares.reduce(
    (sum, share) => sum + share.baseCop + share.residueCop,
    0,
  );

  return assigned + distribution.residueCop;
}

it("given an uneven equal tip pool and no tax, when shares are computed, then bases plus residue equal the pool and the run repeats", () => {
  const input = {
    poolCop: 100000,
    mode: "equal" as const,
    participants: [
      { userId: MARIA, workedMinutes: 0 },
      { userId: LUIS, workedMinutes: 0 },
      { userId: ANA, workedMinutes: 0 },
    ],
    percentages: [],
    removedEmployeeIds: [],
  };

  const first = distributeTips(input);
  const second = distributeTips(input);

  expect(first).toEqual({
    shares: [
      { userId: ANA, baseCop: 33333, residueCop: 1 },
      { userId: LUIS, baseCop: 33333, residueCop: 0 },
      { userId: MARIA, baseCop: 33333, residueCop: 0 },
    ],
    residueCop: 0,
  });
  expect(pesos(first)).toBe(100000);
  expect(first.shares.every((share) => Number.isInteger(share.baseCop))).toBe(
    true,
  );
  expect(
    first.shares.every((share) => Number.isInteger(share.residueCop)),
  ).toBe(true);
  expect(Number.isInteger(first.residueCop)).toBe(true);
  expect(second).toEqual(first);
});

it("given a percentage rule, when extra pesos remain, then they follow userId order on the share", () => {
  const distribution = distributeTips({
    poolCop: 101,
    mode: "percentage",
    participants: [
      { userId: BEA, workedMinutes: 0 },
      { userId: ANA, workedMinutes: 0 },
    ],
    percentages: [
      { employeeId: BEA, percent: 40 },
      { employeeId: ANA, percent: 60 },
    ],
    removedEmployeeIds: [],
  });

  expect(distribution).toEqual({
    shares: [
      { userId: ANA, baseCop: 60, residueCop: 1 },
      { userId: BEA, baseCop: 40, residueCop: 0 },
    ],
    residueCop: 0,
  });
  expect(pesos(distribution)).toBe(101);
});

it("given a zero-minute hours row, when shares are computed, then that row stays at zero", () => {
  const distribution = distributeTips({
    poolCop: 5,
    mode: "hours",
    participants: [
      { userId: ANA, workedMinutes: 0 },
      { userId: COCO, workedMinutes: 1 },
      { userId: BEA, workedMinutes: 1 },
    ],
    percentages: [],
    removedEmployeeIds: [],
  });

  expect(distribution).toEqual({
    shares: [
      { userId: ANA, baseCop: 0, residueCop: 0 },
      { userId: BEA, baseCop: 2, residueCop: 1 },
      { userId: COCO, baseCop: 2, residueCop: 0 },
    ],
    residueCop: 0,
  });
  expect(pesos(distribution)).toBe(5);
});

it("given a removed employee's percentage, when shares are computed, then that percent stays in the residue", () => {
  const distribution = distributeTips({
    poolCop: 10000,
    mode: "percentage",
    participants: [
      { userId: ANA, workedMinutes: 60 },
      { userId: BEA, workedMinutes: 40 },
    ],
    percentages: [
      { employeeId: ANA, percent: 60 },
      { employeeId: BEA, percent: 40 },
    ],
    removedEmployeeIds: [BEA],
  });

  expect(distribution.shares).toEqual([
    { userId: ANA, baseCop: 6000, residueCop: 0 },
  ]);
  expect(distribution.residueCop).toBe(4000);
  expect(pesos(distribution)).toBe(10000);
});

it("given a zero pool, when shares are computed, then there are no shares", () => {
  const participants = [
    { userId: ANA, workedMinutes: 60 },
    { userId: BEA, workedMinutes: 30 },
  ];
  const percentages = [
    { employeeId: ANA, percent: 60 },
    { employeeId: BEA, percent: 40 },
  ];

  const equal = distributeTips({
    poolCop: 0,
    mode: "equal",
    participants,
    percentages: [],
    removedEmployeeIds: [],
  });
  const hours = distributeTips({
    poolCop: 0,
    mode: "hours",
    participants,
    percentages: [],
    removedEmployeeIds: [],
  });
  const percentage = distributeTips({
    poolCop: 0,
    mode: "percentage",
    participants,
    percentages,
    removedEmployeeIds: [],
  });

  expect(equal).toEqual({ shares: [], residueCop: 0 });
  expect(hours).toEqual({ shares: [], residueCop: 0 });
  expect(percentage).toEqual({ shares: [], residueCop: 0 });
});

it("given a pool that is not an integer number of pesos, when shares are computed, then it is rejected", () => {
  const distribute = () => {
    distributeTips({
      poolCop: 10.5,
      mode: "equal",
      participants: [{ userId: ANA, workedMinutes: 0 }],
      percentages: [],
      removedEmployeeIds: [],
    });
  };

  expect(distribute).toThrow(InvalidTipDistribution);
});
