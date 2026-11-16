import type { EvaluateCoverageInput } from "@blackhole/inventory/application/entry-port";
import { expect, it } from "vitest";

import {
  COVERAGE_QUEUE,
  DISH_ALERT_QUEUE,
  ESCALATION_QUEUE,
  type ShortageAlertDependencies,
  SHORTAGE_ALERTS_CRON,
  SHORTAGE_ALERTS_TIME_ZONE,
  SUGGESTION_QUEUE,
  registerShortageAlerts,
} from "#src/composition/shortage-alerts.worker.js";

const COVERAGE_NAME = "inventory.evaluate-coverage";
const DISH_NAME = "inventory.evaluate-dish-alert";
const ESCALATION_NAME = "inventory.escalate-alerts";
const SUGGESTION_NAME = "inventory.propose-stock-levels";
const EVERY_FIFTEEN_MINUTES = "*/15 * * * *";
const UTC = "2026-11-15T20:00:00.000Z";

interface RecordedQueue {
  name: string;
  retryLimit: number | undefined;
}

interface RecordedSchedule {
  name: string;
  cron: string;
  tz: string | undefined;
}

type JobHandler = (jobs: ReadonlyArray<{ data: object }>) => Promise<void>;

const utcClock = {
  now: () => Date.parse(UTC),
};

const coverageJob = {
  tenantId: "tenant-1",
  brandId: "brand-1",
  venueId: "venue-1",
  locationId: "location-1",
  ingredientId: "beef",
};

const dishJob = {
  tenantId: "tenant-1",
  venueId: "venue-1",
  productId: "dish-1",
};

const escalationJob = {
  tenantId: "tenant-1",
  venueId: "venue-1",
};

const suggestionJob = {
  tenantId: "tenant-1",
  brandId: "brand-1",
  venueId: "venue-1",
  locationId: "location-1",
  ingredientId: "beef",
  dailyConsumption: 4,
  leadTimeDays: 2,
};

const fakeBoss = () => {
  const queues: RecordedQueue[] = [];
  const schedules: RecordedSchedule[] = [];
  const handlers = new Map<string, JobHandler>();

  return {
    queues,
    schedules,
    handlers,
    async createQueue(name: string, options?: { retryLimit?: number }) {
      queues.push({ name, retryLimit: options?.retryLimit });
    },
    async work(name: string, handler: JobHandler) {
      handlers.set(name, handler);
    },
    async schedule(
      name: string,
      cron: string,
      _data?: object,
      options?: { tz?: string },
    ) {
      schedules.push({ name, cron, tz: options?.tz });
    },
  };
};

const jobs = (
  alertsEnabled: boolean,
  calls: string[],
  coverage?: { input?: EvaluateCoverageInput },
): ShortageAlertDependencies => ({
  alertsEnabled: () => Promise.resolve(alertsEnabled),
  inTransaction: (_tenantId, work) =>
    work({
      balance: () => Promise.resolve(0),
    }),
  coverage: {
    evaluate: (_tx, input) => {
      calls.push("coverage");
      if (coverage) {
        coverage.input = input;
      }
      return Promise.resolve({ written: false });
    },
  },
  dish: {
    evaluate: () => {
      calls.push("dish");
      return Promise.resolve({ written: false });
    },
  },
  escalation: {
    execute: () => {
      calls.push("escalation");
      return Promise.resolve([]);
    },
  },
  suggestions: {
    execute: () => {
      calls.push("suggestions");
      return Promise.resolve(undefined);
    },
  },
});

it("given the shortage worker, when it registers, then it creates four queues and schedules each every 15 minutes in UTC", async () => {
  const boss = fakeBoss();

  await registerShortageAlerts(boss, jobs(false, []), utcClock);

  expect(COVERAGE_QUEUE).toBe(COVERAGE_NAME);
  expect(DISH_ALERT_QUEUE).toBe(DISH_NAME);
  expect(ESCALATION_QUEUE).toBe(ESCALATION_NAME);
  expect(SUGGESTION_QUEUE).toBe(SUGGESTION_NAME);
  expect(SHORTAGE_ALERTS_CRON).toBe(EVERY_FIFTEEN_MINUTES);
  expect(SHORTAGE_ALERTS_TIME_ZONE).toBe("UTC");
  expect(boss.queues).toEqual([
    { name: COVERAGE_NAME, retryLimit: 0 },
    { name: DISH_NAME, retryLimit: 0 },
    { name: ESCALATION_NAME, retryLimit: 0 },
    { name: SUGGESTION_NAME, retryLimit: 0 },
  ]);
  expect(boss.schedules).toEqual([
    { name: COVERAGE_NAME, cron: EVERY_FIFTEEN_MINUTES, tz: "UTC" },
    { name: DISH_NAME, cron: EVERY_FIFTEEN_MINUTES, tz: "UTC" },
    { name: ESCALATION_NAME, cron: EVERY_FIFTEEN_MINUTES, tz: "UTC" },
    { name: SUGGESTION_NAME, cron: EVERY_FIFTEEN_MINUTES, tz: "UTC" },
  ]);
  expect(boss.handlers.size).toBe(4);
});

it("given shortage alerts are off for the venue, when each job runs, then the use case is not called", async () => {
  const boss = fakeBoss();
  const calls: string[] = [];

  await registerShortageAlerts(boss, jobs(false, calls), utcClock);
  await boss.handlers.get(COVERAGE_QUEUE)?.([{ data: coverageJob }]);
  await boss.handlers.get(DISH_ALERT_QUEUE)?.([{ data: dishJob }]);
  await boss.handlers.get(ESCALATION_QUEUE)?.([{ data: escalationJob }]);
  await boss.handlers.get(SUGGESTION_QUEUE)?.([{ data: suggestionJob }]);

  expect(calls).toEqual([]);
});

it("given shortage alerts are on, when coverage runs, then it calls EvaluateCoverage with the UTC clock", async () => {
  const boss = fakeBoss();
  const calls: string[] = [];
  const coverage: { input?: EvaluateCoverageInput } = {};

  await registerShortageAlerts(boss, jobs(true, calls, coverage), utcClock);
  await boss.handlers.get(COVERAGE_QUEUE)?.([{ data: coverageJob }]);

  expect(calls).toEqual(["coverage"]);
  expect(coverage.input).toEqual({
    ...coverageJob,
    occurredAt: UTC,
  });
});
