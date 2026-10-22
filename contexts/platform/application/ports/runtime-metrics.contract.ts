import { expect, it } from "vitest";
import type { RuntimeMetrics } from "#application/ports/runtime-metrics.js";

export interface PublishedQueue {
  waiting: number;
  oldestAgeSeconds: number;
}

export type RuntimeMetricsSubject = RuntimeMetrics & {
  publishedQueue(): readonly PublishedQueue[];
};

export function runtimeMetricsContract(
  createMetrics: () => RuntimeMetricsSubject | Promise<RuntimeMetricsSubject>,
): void {
  it("given queue depth and age, when they are published, then both values are recorded", async () => {
    const metrics = await createMetrics();

    await metrics.publishQueue({ waiting: 4, oldestAgeSeconds: 12 });

    expect(metrics.publishedQueue()).toEqual([
      { waiting: 4, oldestAgeSeconds: 12 },
    ]);
  });
}
