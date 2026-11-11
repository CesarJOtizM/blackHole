import {
  type ProviderRateDecision,
  ProviderRateGate,
  providerRequestsPerMinute,
  providerRetryAfterSeconds,
  providerWindowStartedAt,
} from "#application/ports/provider-rate-gate.js";

export class InMemoryProviderRateGate extends ProviderRateGate {
  private readonly counts = new Map<string, Map<number, number>>();

  override async acquire(
    taxId: string,
    at: Date,
    ceiling = providerRequestsPerMinute,
  ): Promise<ProviderRateDecision> {
    const windowStartedAt = providerWindowStartedAt(at);
    const windows = this.counts.get(taxId) ?? new Map<number, number>();
    const count = windows.get(windowStartedAt) ?? 0;

    if (count >= ceiling) {
      return {
        allowed: false,
        retryAfterSeconds: providerRetryAfterSeconds(at),
      };
    }

    windows.set(windowStartedAt, count + 1);
    this.counts.set(taxId, windows);
    return { allowed: true };
  }
}
