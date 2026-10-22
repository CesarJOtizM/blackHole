import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { expect, it } from "vitest";

import { observeQueue } from "#src/worker.js";

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
