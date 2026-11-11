export const providerRequestsPerMinute = 80;
export const providerWindowMilliseconds = 60_000;

export type ProviderRateDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function providerWindowStartedAt(at: Date): number {
  return (
    Math.floor(at.getTime() / providerWindowMilliseconds) *
    providerWindowMilliseconds
  );
}

export function providerRetryAfterSeconds(at: Date): number {
  const remainingMilliseconds =
    providerWindowStartedAt(at) + providerWindowMilliseconds - at.getTime();
  return Math.ceil(remainingMilliseconds / 1000);
}

export abstract class ProviderRateGate {
  abstract acquire(
    taxId: string,
    at: Date,
    ceiling?: number,
  ): Promise<ProviderRateDecision>;
}
