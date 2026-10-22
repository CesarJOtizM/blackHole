import {
  type QueueDepth,
  RuntimeMetrics,
} from "#application/ports/runtime-metrics.js";

export interface GcpMetricsClient {
  createTimeSeries(snapshot: QueueDepth): Promise<void>;
}

export class GcpRuntimeMetrics extends RuntimeMetrics {
  constructor(private readonly client: GcpMetricsClient) {
    super();
  }

  override async publishQueue(depth: QueueDepth): Promise<void> {
    await this.client.createTimeSeries(depth);
  }
}
