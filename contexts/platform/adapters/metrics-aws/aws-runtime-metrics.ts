import {
  type QueueDepth,
  RuntimeMetrics,
} from "#application/ports/runtime-metrics.js";

export interface AwsMetricsClient {
  putMetricData(snapshot: QueueDepth): Promise<void>;
}

export class AwsRuntimeMetrics extends RuntimeMetrics {
  constructor(private readonly client: AwsMetricsClient) {
    super();
  }

  override async publishQueue(depth: QueueDepth): Promise<void> {
    await this.client.putMetricData(depth);
  }
}
