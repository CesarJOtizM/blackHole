export interface QueueDepth {
  waiting: number;
  oldestAgeSeconds: number;
}

export abstract class RuntimeMetrics {
  abstract publishQueue(depth: QueueDepth): Promise<void>;
}
