import type { FACTUS_RESPONSE_STATUS } from "@blackhole/platform/domain";

export type FactusIssueResult =
  | { readonly status: 200 }
  | { readonly status: 429; readonly retryAfterSeconds: number }
  | { readonly status: typeof FACTUS_RESPONSE_STATUS.REJECTED }
  | { readonly status: typeof FACTUS_RESPONSE_STATUS.SERVER_ERROR };

export class FactusSimulator {
  private cursor = 0;

  constructor(private readonly outcomes: readonly FactusIssueResult[] = []) {}

  async issue(): Promise<FactusIssueResult> {
    const outcome = this.outcomes[this.cursor] ?? { status: 200 as const };
    this.cursor += 1;
    return outcome;
  }
}
