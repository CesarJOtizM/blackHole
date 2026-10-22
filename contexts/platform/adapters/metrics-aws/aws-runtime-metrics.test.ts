import { expect, it } from "vitest";

import { AwsRuntimeMetrics } from "#adapters/metrics-aws/aws-runtime-metrics.js";

it("given an aws client, when queue depth is published, then the client receives both values", async () => {
  const seen: { waiting: number; oldestAgeSeconds: number }[] = [];
  const metrics = new AwsRuntimeMetrics({
    async putMetricData(snapshot) {
      seen.push(snapshot);
    },
  });

  await metrics.publishQueue({ waiting: 2, oldestAgeSeconds: 8 });

  expect(seen).toEqual([{ waiting: 2, oldestAgeSeconds: 8 }]);
});
