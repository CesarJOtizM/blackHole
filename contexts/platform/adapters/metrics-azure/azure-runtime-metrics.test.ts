import { expect, it } from "vitest";

import { AzureRuntimeMetrics } from "#adapters/metrics-azure/azure-runtime-metrics.js";

it("given an azure client, when queue depth is published, then the client receives both values", async () => {
  const seen: { waiting: number; oldestAgeSeconds: number }[] = [];
  const metrics = new AzureRuntimeMetrics({
    async trackMetric(snapshot) {
      seen.push(snapshot);
    },
  });

  await metrics.publishQueue({ waiting: 2, oldestAgeSeconds: 8 });

  expect(seen).toEqual([{ waiting: 2, oldestAgeSeconds: 8 }]);
});
