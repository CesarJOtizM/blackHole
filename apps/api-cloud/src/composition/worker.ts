import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  PendingIssuance,
  PendingIssuanceSnapshot,
} from "@blackhole/platform/application/ports/pending-issuance";
import type { ProviderRateGate } from "@blackhole/platform/application/ports/provider-rate-gate";
import type { RuntimeMetrics } from "@blackhole/platform/application/ports/runtime-metrics";
import {
  FACTUS_RESPONSE_STATUS,
  METRIC_NAME,
} from "@blackhole/platform/domain";
import { PgBoss } from "pg-boss";

import type {
  FactusIssueResult,
  FactusSimulator,
} from "#src/composition/factus-simulator.js";
import { infrastructureFromEnv } from "#src/composition/main.js";
import { startTelemetry } from "#src/composition/telemetry.js";

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

export interface IssuePendingSale {
  id: string;
  soldAt: number;
}

export interface IssuePendingJob {
  taxId: string;
  at: Date;
  sales: readonly IssuePendingSale[];
}

export interface FactusResponseRecord {
  name: typeof METRIC_NAME.FACTUS_RESPONSES;
  taxId: string;
  status: (typeof FACTUS_RESPONSE_STATUS)[keyof typeof FACTUS_RESPONSE_STATUS];
}

export interface IssuePendingDependencies {
  providerRate: ProviderRateGate;
  pendingIssuance: PendingIssuance;
  factus: FactusSimulator;
}

export interface IssuePendingResult {
  issuedSaleIds: readonly string[];
  rescheduledSaleIds: readonly string[];
  retryAfterSeconds?: number;
  responses: readonly FactusResponseRecord[];
  openIssuances: readonly PendingIssuanceSnapshot[];
}

const inSaleOrder = (sales: readonly IssuePendingSale[]): IssuePendingSale[] =>
  [...sales].sort((left, right) => {
    if (left.soldAt !== right.soldAt) {
      return left.soldAt - right.soldAt;
    }

    return left.id.localeCompare(right.id);
  });

const recordedStatus = (
  result: Exclude<FactusIssueResult, { status: 200 }>,
): FactusResponseRecord["status"] => {
  if (result.status === 429) {
    return FACTUS_RESPONSE_STATUS.TOO_MANY_REQUESTS;
  }

  return result.status;
};

export const issuePending = async (
  job: IssuePendingJob,
  dependencies: IssuePendingDependencies,
): Promise<IssuePendingResult> => {
  const sales = inSaleOrder(job.sales);
  const openIssuances = await dependencies.pendingIssuance.snapshot();
  const issuedSaleIds: string[] = [];
  const responses: FactusResponseRecord[] = [];

  const reschedule = (
    from: number,
    retryAfterSeconds: number,
  ): IssuePendingResult => ({
    issuedSaleIds,
    rescheduledSaleIds: sales.slice(from).map((sale) => sale.id),
    retryAfterSeconds,
    responses,
    openIssuances,
  });

  for (const [index, sale] of sales.entries()) {
    const decision = await dependencies.providerRate.acquire(job.taxId, job.at);

    if (!decision.allowed) {
      return reschedule(index, decision.retryAfterSeconds);
    }

    const result = await dependencies.factus.issue();

    if (result.status === 200) {
      issuedSaleIds.push(sale.id);
      continue;
    }

    responses.push({
      name: METRIC_NAME.FACTUS_RESPONSES,
      taxId: job.taxId,
      status: recordedStatus(result),
    });

    if (result.status === 429) {
      return reschedule(index, result.retryAfterSeconds);
    }
  }

  return {
    issuedSaleIds,
    rescheduledSaleIds: [],
    responses,
    openIssuances,
  };
};

export const startWorker = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> => {
  const runtime = infrastructureFromEnv(env);
  startTelemetry(env);
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
