import { expect, it } from "vitest";

import { InvalidTipWindow, TipPeriod } from "#domain/tip-period.js";

const DURING_WEDNESDAY = "2026-03-18T20:00:00.000Z";
const BEFORE_WEDNESDAY = "2026-03-18T04:59:59.999Z";
const BOGOTA_TUESDAY_START = "2026-03-17T05:00:00.000Z";
const BOGOTA_WEDNESDAY_START = "2026-03-18T05:00:00.000Z";
const BOGOTA_THURSDAY_START = "2026-03-19T05:00:00.000Z";

const DURING_WEEK = "2026-03-18T15:00:00.000Z";
const SUNDAY_EVENING = "2026-03-16T03:00:00.000Z";
const PREVIOUS_MONDAY_START = "2026-03-09T05:00:00.000Z";
const BOGOTA_MONDAY_START = "2026-03-16T05:00:00.000Z";
const BOGOTA_NEXT_MONDAY_START = "2026-03-23T05:00:00.000Z";

const SHIFT_FROM = "2026-03-18T22:00:00.000Z";
const SHIFT_TO = "2026-03-19T06:00:00.000Z";
const DURING_SHIFT = "2026-03-19T05:30:00.000Z";

it("given a payment during a Bogota day, when the day window is resolved, then it is half-open at UTC-5 midnights", () => {
  const period = TipPeriod.day({ at: DURING_WEDNESDAY });

  expect(period.kind).toBe("day");
  expect(period.from).toBe(BOGOTA_WEDNESDAY_START);
  expect(period.to).toBe(BOGOTA_THURSDAY_START);
  expect(period.contains(BOGOTA_WEDNESDAY_START)).toBe(true);
  expect(period.contains(BEFORE_WEDNESDAY)).toBe(false);
  expect(period.contains(BOGOTA_THURSDAY_START)).toBe(false);
});

it("given a payment one millisecond before Bogota midnight, when the day window is resolved, then it belongs to the previous day", () => {
  const period = TipPeriod.day({ at: BEFORE_WEDNESDAY });

  expect(period.from).toBe(BOGOTA_TUESDAY_START);
  expect(period.to).toBe(BOGOTA_WEDNESDAY_START);
  expect(period.contains(BEFORE_WEDNESDAY)).toBe(true);
  expect(period.contains(BOGOTA_WEDNESDAY_START)).toBe(false);
});

it("given a payment on a Wednesday in Bogota, when the week window is resolved, then it is half-open from Monday to the next Monday", () => {
  const period = TipPeriod.week({ at: DURING_WEEK });

  expect(period.kind).toBe("week");
  expect(period.from).toBe(BOGOTA_MONDAY_START);
  expect(period.to).toBe(BOGOTA_NEXT_MONDAY_START);
  expect(period.contains(BOGOTA_MONDAY_START)).toBe(true);
  expect(period.contains(SUNDAY_EVENING)).toBe(false);
  expect(period.contains(BOGOTA_NEXT_MONDAY_START)).toBe(false);
});

it("given a payment on Sunday evening in Bogota, when the week window is resolved, then it belongs to the week that opened the previous Monday", () => {
  const period = TipPeriod.week({ at: SUNDAY_EVENING });

  expect(period.from).toBe(PREVIOUS_MONDAY_START);
  expect(period.to).toBe(BOGOTA_MONDAY_START);
  expect(period.contains(SUNDAY_EVENING)).toBe(true);
  expect(period.contains(BOGOTA_MONDAY_START)).toBe(false);
});

it("given a shift from and to, when the window is resolved, then it keeps the caller bounds and excludes the end", () => {
  const period = TipPeriod.shift({ from: SHIFT_FROM, to: SHIFT_TO });

  expect(period.kind).toBe("shift");
  expect(period.from).toBe(SHIFT_FROM);
  expect(period.to).toBe(SHIFT_TO);
  expect(period.contains(SHIFT_FROM)).toBe(true);
  expect(period.contains(DURING_SHIFT)).toBe(true);
  expect(period.contains(SHIFT_TO)).toBe(false);
});

it("given a shift whose start is not before its end, when the window is resolved, then it is rejected", () => {
  const resolve = () => {
    TipPeriod.shift({ from: SHIFT_TO, to: SHIFT_FROM });
  };

  expect(resolve).toThrow(InvalidTipWindow);
});
