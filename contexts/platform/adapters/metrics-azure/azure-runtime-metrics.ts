import {
  type QueueDepth,
  RuntimeMetrics,
} from "#application/ports/runtime-metrics.js";

export interface AzureMetricsClient {
  trackMetric(snapshot: QueueDepth): Promise<void>;
}

export class AzureRuntimeMetrics extends RuntimeMetrics {
  constructor(private readonly client: AzureMetricsClient) {
    super();
  }

  override async publishQueue(depth: QueueDepth): Promise<void> {
    await this.client.trackMetric(depth);
  }
}
