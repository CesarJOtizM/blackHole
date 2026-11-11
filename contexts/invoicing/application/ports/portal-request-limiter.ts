export interface PortalLimitAttempt {
  token: string;
  ip: string;
}

export abstract class PortalRequestLimiter {
  abstract acquire(attempt: PortalLimitAttempt): Promise<boolean>;
}
