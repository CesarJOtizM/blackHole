import {
  RealtimeHub,
  type RealtimeNotice,
} from "#application/ports/realtime-hub.js";

const cloneNotice = (notice: RealtimeNotice): RealtimeNotice => {
  if (notice.kind === "ids") {
    return { ...notice, lineIds: [...notice.lineIds] };
  }

  return { ...notice };
};

export class InMemoryRealtimeHub extends RealtimeHub {
  readonly published: RealtimeNotice[] = [];

  private readonly listeners = new Set<(notice: RealtimeNotice) => void>();

  override async publish(notice: RealtimeNotice): Promise<void> {
    const cloned = cloneNotice(notice);

    this.published.push(cloned);

    for (const listener of [...this.listeners]) {
      listener(cloneNotice(cloned));
    }
  }

  override subscribe(listener: (notice: RealtimeNotice) => void): () => void {
    this.listeners.add(listener);

    for (const notice of [...this.published]) {
      listener(cloneNotice(notice));
    }

    return () => {
      this.listeners.delete(listener);
    };
  }
}
