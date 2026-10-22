import { expect, it } from "vitest";

import { GcpRuntimeMetrics } from "#adapters/metrics-gcp/gcp-runtime-metrics.js";

it("given a gcp client, when queue depth is published, then the client receives both values", async () => {
  const seen: { waiting: number; oldestAgeSeconds: number }[] = [];
  const metrics = new GcpRuntimeMetrics({
    async createTimeSeries(snapshot) {
      seen.push(snapshot);
    },
  });

  await metrics.publishQueue({ waiting: 2, oldestAgeSeconds: 8 });

  expect(seen).toEqual([{ waiting: 2, oldestAgeSeconds: 8 }]);
});
