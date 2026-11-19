import type { ShortageNotice } from "@blackhole/contracts";

export class ShortageNoticeHub {
  private readonly listeners = new Set<(notice: ShortageNotice) => void>();

  publish(notice: ShortageNotice): void {
    for (const listener of this.listeners) {
      listener(notice);
    }
  }

  subscribe(listener: (notice: ShortageNotice) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
