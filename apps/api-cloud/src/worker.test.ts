import { FakeClock } from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { InMemoryPendingIssuance } from "@blackhole/platform/adapters/memory/in-memory-pending-issuance";
import { InMemoryProviderRateGate } from "@blackhole/platform/adapters/memory/in-memory-provider-rate-gate";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { providerRequestsPerMinute } from "@blackhole/platform/application/ports/provider-rate-gate";
import {
  FACTUS_RESPONSE_STATUS,
  METRIC_NAME,
} from "@blackhole/platform/domain";
import { expect, it } from "vitest";

import { FactusSimulator } from "#src/factus-simulator.js";
import { issuePending, observeQueue } from "#src/worker.js";

it("given waiting jobs and their age, when the worker publishes, then metrics receive both and no handler is registered", async () => {
  const calls: string[] = [];
  const metrics = new InMemoryRuntimeMetrics();
  const queue = {
    async start() {
      calls.push("start");
    },
    async getQueues() {
      calls.push("getQueues");
      return [
        { queuedCount: 2, readyOldestSeconds: 5 },
        { queuedCount: 1, readyOldestSeconds: 9 },
      ];
    },
    async work() {
      calls.push("work");
      return "handler";
    },
  };

  await observeQueue(queue, metrics);

  expect(metrics.publishedQueue()).toEqual([
    { waiting: 3, oldestAgeSeconds: 9 },
  ]);
  expect(calls).toEqual(["start", "getQueues"]);
});

it("given an empty queue, when the worker publishes, then depth and age are zero and no handler is registered", async () => {
  const calls: string[] = [];
  const metrics = new InMemoryRuntimeMetrics();
  const queue = {
    async start() {
      calls.push("start");
    },
    async getQueues() {
      return [];
    },
    async work() {
      calls.push("work");
      return "handler";
    },
  };

  await observeQueue(queue, metrics);

  expect(metrics.publishedQueue()).toEqual([
    { waiting: 0, oldestAgeSeconds: 0 },
  ]);
  expect(calls).toEqual(["start"]);
});

it("given sales out of sale order, when the issue-pending job runs, then they are issued in sale order", async () => {
  const pendingIssuance = await openIssuance();
  const gate = new InMemoryProviderRateGate();

  const outcome = await issuePending(
    issueJob(),
    dependencies(gate, pendingIssuance, new FactusSimulator()),
  );

  expect(outcome.issuedSaleIds).toEqual(saleOrder);
  expect(outcome.rescheduledSaleIds).toEqual([]);
  expect(outcome.responses).toEqual([]);
  expect(outcome.openIssuances).toEqual([
    { venueId: "venue-1", status: "pending_issuance", ageSeconds: 1 },
  ]);
});

it("given more than 80 requests in the minute, when the issue-pending job runs, then the sales are rescheduled in sale order", async () => {
  const gate = new InMemoryProviderRateGate();
  for (let index = 0; index < providerRequestsPerMinute; index += 1) {
    await gate.acquire(taxId, at);
  }

  const outcome = await issuePending(
    issueJob(),
    dependencies(gate, new InMemoryPendingIssuance(new FakeClock(1_000))),
  );

  expect(outcome.issuedSaleIds).toEqual([]);
  expect(outcome.rescheduledSaleIds).toEqual(saleOrder);
  expect(outcome.retryAfterSeconds).toBe(50);
  expect(outcome.responses).toEqual([]);
});

it("given Factus returns 429, when the issue-pending job runs, then the sales are rescheduled in sale order and factus.responses records 429", async () => {
  const outcome = await issuePending(
    issueJob(),
    dependencies(
      new InMemoryProviderRateGate(),
      new InMemoryPendingIssuance(new FakeClock(1_000)),
      new FactusSimulator([{ status: 429, retryAfterSeconds: 12 }]),
    ),
  );

  expect(outcome.issuedSaleIds).toEqual([]);
  expect(outcome.rescheduledSaleIds).toEqual(saleOrder);
  expect(outcome.retryAfterSeconds).toBe(12);
  expect(outcome.responses).toEqual([
    {
      name: METRIC_NAME.FACTUS_RESPONSES,
      taxId,
      status: FACTUS_RESPONSE_STATUS.TOO_MANY_REQUESTS,
    },
  ]);
});

it("given Factus rejects a sale and then fails, when the issue-pending job runs, then factus.responses records rejected and server_error", async () => {
  const outcome = await issuePending(
    issueJob(),
    dependencies(
      new InMemoryProviderRateGate(),
      new InMemoryPendingIssuance(new FakeClock(1_000)),
      new FactusSimulator([
        { status: "rejected" },
        { status: "server_error" },
        { status: 200 },
      ]),
    ),
  );

  expect(outcome.issuedSaleIds).toEqual(["sale-c"]);
  expect(outcome.rescheduledSaleIds).toEqual([]);
  expect(outcome.responses).toEqual([
    {
      name: METRIC_NAME.FACTUS_RESPONSES,
      taxId,
      status: FACTUS_RESPONSE_STATUS.REJECTED,
    },
    {
      name: METRIC_NAME.FACTUS_RESPONSES,
      taxId,
      status: FACTUS_RESPONSE_STATUS.SERVER_ERROR,
    },
  ]);
});

it("given queue depth and a Factus 429, when the worker publishes and issue-pending runs, then publishQueue stays depth and age", async () => {
  const metrics = new InMemoryRuntimeMetrics();
  const queue = {
    async start() {
      return undefined;
    },
    async getQueues() {
      return [{ queuedCount: 1, readyOldestSeconds: 4 }];
    },
  };

  await observeQueue(queue, metrics);
  const outcome = await issuePending(
    issueJob(),
    dependencies(
      new InMemoryProviderRateGate(),
      new InMemoryPendingIssuance(new FakeClock(1_000)),
      new FactusSimulator([{ status: 429, retryAfterSeconds: 12 }]),
    ),
  );

  expect(metrics.publishedQueue()).toEqual([
    { waiting: 1, oldestAgeSeconds: 4 },
  ]);
  expect(outcome.responses).toEqual([
    {
      name: METRIC_NAME.FACTUS_RESPONSES,
      taxId,
      status: FACTUS_RESPONSE_STATUS.TOO_MANY_REQUESTS,
    },
  ]);
});

const taxId = "900111111";
const at = new Date("2026-10-22T12:00:10.000Z");
const saleOrder = ["sale-a", "sale-b", "sale-c"];

function issueJob() {
  return {
    taxId,
    at,
    sales: [
      { id: "sale-c", soldAt: 30 },
      { id: "sale-a", soldAt: 10 },
      { id: "sale-b", soldAt: 20 },
    ],
  };
}

function dependencies(
  providerRate = new InMemoryProviderRateGate(),
  pendingIssuance = new InMemoryPendingIssuance(new FakeClock(1_000)),
  factus = new FactusSimulator(),
) {
  return { providerRate, pendingIssuance, factus };
}

async function openIssuance() {
  const pendingIssuance = new InMemoryPendingIssuance(new FakeClock(1_000));
  await pendingIssuance.record({
    id: "doc-1",
    venueId: "venue-1",
    status: "pending_issuance",
    requestedAt: 0,
  });
  return pendingIssuance;
}
