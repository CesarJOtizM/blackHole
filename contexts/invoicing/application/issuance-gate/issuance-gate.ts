import type { ProviderRateGate } from "@blackhole/platform/application/entry-port";

import type { InvoicingProvider } from "#application/ports/invoicing-provider.js";

export const ISSUANCE_GATE_OUTCOME = {
  SENT: "sent",
  WAITING: "waiting",
} as const;

export type IssuanceGateOutcome =
  (typeof ISSUANCE_GATE_OUTCOME)[keyof typeof ISSUANCE_GATE_OUTCOME];

export interface SentIssuance {
  outcome: typeof ISSUANCE_GATE_OUTCOME.SENT;
}

export interface WaitingIssuance {
  outcome: typeof ISSUANCE_GATE_OUTCOME.WAITING;
  retryAfterSeconds: number;
}

export type IssuanceGateResult = SentIssuance | WaitingIssuance;

export interface IssuanceGateCommand {
  taxId: string;
  numberingRangeId: string;
  referenceCode: string;
  at: Date;
}

const released = (current: Promise<void>): Promise<void> =>
  current.then(
    () => undefined,
    () => undefined,
  );

export class IssuanceGate {
  private readonly tails = new Map<string, Promise<void>>();

  constructor(
    private readonly rateGate: ProviderRateGate,
    private readonly provider: InvoicingProvider,
  ) {}

  async execute(command: IssuanceGateCommand): Promise<IssuanceGateResult> {
    const decision = await this.rateGate.acquire(command.taxId, command.at);

    if (!decision.allowed) {
      return {
        outcome: ISSUANCE_GATE_OUTCOME.WAITING,
        retryAfterSeconds: decision.retryAfterSeconds,
      };
    }

    await this.validateOnRange(command.numberingRangeId, () =>
      this.provider.validate({ referenceCode: command.referenceCode }),
    );

    return { outcome: ISSUANCE_GATE_OUTCOME.SENT };
  }

  private async validateOnRange(
    numberingRangeId: string,
    validate: () => Promise<void>,
  ): Promise<void> {
    const previous = this.tails.get(numberingRangeId) ?? Promise.resolve();
    const current = previous.then(validate);
    this.tails.set(numberingRangeId, released(current));

    await current;
  }
}
