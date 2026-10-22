import { expect, it } from "vitest";

import { LogRuntimeMetrics } from "#adapters/metrics-log/log-runtime-metrics.js";

it("given a log client, when queue depth is published, then the client receives both values", async () => {
  const seen: { waiting: number; oldestAgeSeconds: number }[] = [];
  const metrics = new LogRuntimeMetrics({
    write(snapshot) {
      seen.push(snapshot);
    },
  });

  await metrics.publishQueue({ waiting: 2, oldestAgeSeconds: 8 });

  expect(seen).toEqual([{ waiting: 2, oldestAgeSeconds: 8 }]);
});
