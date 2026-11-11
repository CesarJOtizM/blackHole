import { expect, it } from "vitest";

import type {
  PortalLimitAttempt,
  PortalRequestLimiter,
} from "#application/ports/portal-request-limiter.js";

export interface PortalRequestLimiterHarness {
  limiter(): PortalRequestLimiter;
  attempt(): PortalLimitAttempt;
  acquired(): readonly PortalLimitAttempt[];
}

export function portalRequestLimiterContract(
  open: () =>
    | PortalRequestLimiterHarness
    | Promise<PortalRequestLimiterHarness>,
): void {
  it("given a portal token and an IP, when a request is acquired, then that pair is the attempt", async () => {
    const opened = await open();
    const attempt = opened.attempt();

    expect(await opened.limiter().acquire(attempt)).toBe(true);
    expect(opened.acquired()).toEqual([attempt]);
  });
}
