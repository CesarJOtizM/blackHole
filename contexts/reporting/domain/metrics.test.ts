import { expect, it } from "vitest";

import {
  average,
  durationMs,
  nearestRank,
  netSalesCop,
} from "#domain/metrics.js";

const STARTED_AT = "2026-11-11T18:00:00.000Z";
const READY_AT = "2026-11-11T18:02:00.000Z";

it("given a line never marked ready, when preparation time is computed, then that line contributes no value", () => {
  const sample = durationMs(STARTED_AT, null);

  expect(sample).toBeNull();
});

it("given a missing start, when the span is computed, then the sample is dropped", () => {
  const sample = durationMs(null, READY_AT);

  expect(sample).toBeNull();
});

it("given both ends, when the span is computed, then the duration is the difference", () => {
  const sample = durationMs(STARTED_AT, READY_AT);

  expect(sample).toBe(120_000);
});

it("given an empty sample, when p50, p90 and the average are read, then no figure is returned", () => {
  expect(nearestRank([], 50)).toBeNull();
  expect(nearestRank([], 90)).toBeNull();
  expect(average([])).toBeNull();
});

it("given four durations, when p50 and p90 are read, then the rank is ceil(p/100*n)-1", () => {
  const samples = [40, 10, 30, 20];

  expect(nearestRank(samples, 50)).toBe(20);
  expect(nearestRank(samples, 90)).toBe(40);
});

it("given gross, discount, included tax and tip, when net sales are computed, then those three are subtracted", () => {
  const net = netSalesCop({
    grossCop: 10_000,
    discountCop: 1_000,
    includedTaxCop: 1_900,
    tipCop: 500,
  });

  expect(net).toBe(6_600);
});
