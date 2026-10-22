import {
  type QueueDepth,
  RuntimeMetrics,
} from "#application/ports/runtime-metrics.js";

export class InMemoryRuntimeMetrics extends RuntimeMetrics {
  private readonly published: QueueDepth[] = [];

  override async publishQueue(depth: QueueDepth): Promise<void> {
    this.published.push(depth);
  }

  publishedQueue(): readonly QueueDepth[] {
    return this.published;
  }
}
