import { expect, it } from "vitest";

import {
  InvalidTipPercentage,
  InvalidTipRoleShare,
  TipRule,
} from "#domain/tip-rule.js";

const WAITER = "employee-waiter";
const COOK = "employee-cook";

it("given equal mode, when the rule is created, then it keeps no percentage rows", () => {
  const rule = TipRule.equal();

  expect(rule.mode).toBe("equal");
  expect(rule.shares).toEqual([]);
});

it("given hours mode, when the rule is created, then it keeps no percentage rows", () => {
  const rule = TipRule.hours();

  expect(rule.mode).toBe("hours");
  expect(rule.shares).toEqual([]);
});

it("given employee percentages that sum to 100, when the rule is saved, then the integer rows are kept", () => {
  const rule = TipRule.percentage([
    { employeeId: WAITER, percent: 60 },
    { employeeId: COOK, percent: 40 },
  ]);

  expect(rule.mode).toBe("percentage");
  expect(rule.shares).toEqual([
    { employeeId: WAITER, percent: 60 },
    { employeeId: COOK, percent: 40 },
  ]);
});

it("given a single employee at 100 percent, when the rule is saved, then that row is kept", () => {
  const rule = TipRule.percentage([{ employeeId: WAITER, percent: 100 }]);

  expect(rule.shares).toEqual([{ employeeId: WAITER, percent: 100 }]);
});

it("given percentages that do not sum to 100, when the rule is saved, then it is rejected", () => {
  const save = () => {
    TipRule.percentage([
      { employeeId: WAITER, percent: 60 },
      { employeeId: COOK, percent: 30 },
    ]);
  };

  expect(save).toThrow(InvalidTipPercentage);
});

it("given a percentage that is not an integer, when the rule is saved, then it is rejected", () => {
  const save = () => {
    TipRule.percentage([
      { employeeId: WAITER, percent: 50.5 },
      { employeeId: COOK, percent: 49.5 },
    ]);
  };

  expect(save).toThrow(InvalidTipPercentage);
});

it("given a negative percentage that still sums to 100, when the rule is saved, then it is rejected", () => {
  const save = () => {
    TipRule.percentage([
      { employeeId: WAITER, percent: 150 },
      { employeeId: COOK, percent: -50 },
    ]);
  };

  expect(save).toThrow(InvalidTipPercentage);
});

it("given a percentage row with a role key, when the rule is saved, then it is rejected", () => {
  const save = () => {
    TipRule.percentage([
      { employeeId: WAITER, role: "waiter", percent: 70 },
      { employeeId: COOK, role: "kitchen", percent: 30 },
    ]);
  };

  expect(save).toThrow(InvalidTipRoleShare);
});

it("given percentages keyed only by role, when the rule is saved, then it is rejected", () => {
  const save = () => {
    TipRule.percentage([
      { role: "waiter", percent: 70 },
      { role: "kitchen", percent: 30 },
    ]);
  };

  expect(save).toThrow(InvalidTipRoleShare);
});
