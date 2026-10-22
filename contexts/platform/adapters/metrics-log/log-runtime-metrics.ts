import {
  type QueueDepth,
  RuntimeMetrics,
} from "#application/ports/runtime-metrics.js";

export interface LogMetricsClient {
  write(snapshot: QueueDepth): void;
}

export class LogRuntimeMetrics extends RuntimeMetrics {
  constructor(private readonly client: LogMetricsClient) {
    super();
  }

  override async publishQueue(depth: QueueDepth): Promise<void> {
    this.client.write(depth);
  }
}

export const consoleLogMetricsClient = (): LogMetricsClient => ({
  write(snapshot) {
    console.log(JSON.stringify(snapshot));
  },
});
