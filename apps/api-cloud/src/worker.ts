import path from "node:path";
import { pathToFileURL } from "node:url";
import type { RuntimeMetrics } from "@blackhole/platform/application/ports/runtime-metrics";
import { PgBoss } from "pg-boss";

import { infrastructureFromEnv } from "#src/main.js";

export interface QueueSnapshotSource {
  queuedCount: number;
  readyOldestSeconds: number | null;
}

export interface QueueMonitor {
  start(): Promise<unknown>;
  getQueues(): Promise<readonly QueueSnapshotSource[]>;
}

const publishIntervalMs = 10_000;

export const queueDepth = (
  queues: readonly QueueSnapshotSource[],
): { waiting: number; oldestAgeSeconds: number } => {
  const waiting = queues.reduce((sum, queue) => sum + queue.queuedCount, 0);
  const oldestAgeSeconds = queues.reduce(
    (oldest, queue) => Math.max(oldest, queue.readyOldestSeconds ?? 0),
    0,
  );

  return { waiting, oldestAgeSeconds };
};

export const observeQueue = async (
  queue: QueueMonitor,
  metrics: RuntimeMetrics,
): Promise<void> => {
  await queue.start();
  await metrics.publishQueue(queueDepth(await queue.getQueues()));
};

export const startWorker = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> => {
  const runtime = infrastructureFromEnv(env);
  const boss = new PgBoss(runtime.databaseUrl);

  await boss.start();

  const publish = async (): Promise<void> => {
    await runtime.metrics.publishQueue(queueDepth(await boss.getQueues()));
  };

  await publish();
  setInterval(() => {
    void publish();
  }, publishIntervalMs);
};

const entry = process.argv[1];

if (entry && pathToFileURL(path.resolve(entry)).href === import.meta.url) {
  await startWorker();
}
