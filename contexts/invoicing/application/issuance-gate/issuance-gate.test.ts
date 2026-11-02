import { ProviderRateGate } from "@blackhole/platform/application/entry-port";
import { expect, it, vi } from "vitest";
import {
  IssuanceGate,
  type IssuanceGateCommand,
} from "#application/issuance-gate/issuance-gate.js";
import type { InvoiceValidation } from "#application/ports/invoicing-provider.js";
import { InvoicingProvider } from "#application/ports/invoicing-provider.js";

const TAX_ID = "900123456";
const AT = new Date("2026-10-22T12:00:10.000Z");
const REQUESTS_PER_MINUTE = 80;
const RETRY_AFTER_SECONDS = 50;
const MINUTE_MILLISECONDS = 60_000;
const RANGE_A = "range_register";
const RANGE_B = "range_site";
const SENT = { outcome: "sent" } as const;
const WAITING = {
  outcome: "waiting",
  retryAfterSeconds: RETRY_AFTER_SECONDS,
} as const;

const command = (
  numberingRangeId: string,
  referenceCode: string,
): IssuanceGateCommand => ({
  taxId: TAX_ID,
  numberingRangeId,
  referenceCode,
  at: AT,
});

const referenceAt = (index: number): string => `ref_${index}`;

class HeldValidation {
  private resolveHeld: (() => void) | null = null;
  readonly promise: Promise<void>;

  constructor() {
    this.promise = new Promise((resolve) => {
      this.resolveHeld = resolve;
    });
  }

  release(): void {
    this.resolveHeld?.();
    this.resolveHeld = null;
  }
}

class MemoryProviderRateGate extends ProviderRateGate {
  readonly calls: string[] = [];
  private readonly counts = new Map<string, number>();

  constructor(private readonly trace: string[]) {
    super();
  }

  override async acquire(
    taxId: string,
    at: Date,
  ): Promise<
    { allowed: true } | { allowed: false; retryAfterSeconds: number }
  > {
    this.trace.push("acquire");
    this.calls.push(taxId);
    const windowStartedAt =
      Math.floor(at.getTime() / MINUTE_MILLISECONDS) * MINUTE_MILLISECONDS;
    const key = `${taxId}|${windowStartedAt}`;
    const count = this.counts.get(key) ?? 0;

    if (count >= REQUESTS_PER_MINUTE) {
      return {
        allowed: false,
        retryAfterSeconds: RETRY_AFTER_SECONDS,
      };
    }

    this.counts.set(key, count + 1);

    return { allowed: true };
  }
}

class MemoryInvoicingProvider extends InvoicingProvider {
  readonly started: string[] = [];
  private readonly held = new Map<string, HeldValidation>();

  constructor(
    private readonly trace: string[],
    private readonly hold: boolean,
  ) {
    super();
  }

  override validate(invoice: InvoiceValidation): Promise<void> {
    this.trace.push("validate");
    this.started.push(invoice.referenceCode);

    if (!this.hold) {
      return Promise.resolve();
    }

    const held = new HeldValidation();
    this.held.set(invoice.referenceCode, held);

    return held.promise;
  }

  release(referenceCode: string): void {
    const held = this.held.get(referenceCode);
    held?.release();
    this.held.delete(referenceCode);
  }
}

const harness = (hold = false) => {
  const trace: string[] = [];
  const rate = new MemoryProviderRateGate(trace);
  const provider = new MemoryInvoicingProvider(trace, hold);
  const gate = new IssuanceGate(rate, provider);

  return { trace, rate, provider, gate };
};

it("given eighty validations for one nit in the minute, when another range is requested, then the rate gate refuses it before the provider validates", async () => {
  const { trace, gate, provider } = harness();
  const sent = [];

  for (let index = 0; index < REQUESTS_PER_MINUTE; index += 1) {
    sent.push(await gate.execute(command(RANGE_A, referenceAt(index))));
  }

  const refused = await gate.execute(command(RANGE_B, "ref_over_limit"));

  expect(sent).toEqual(Array.from({ length: REQUESTS_PER_MINUTE }, () => SENT));
  expect(provider.started).toEqual(
    Array.from({ length: REQUESTS_PER_MINUTE }, (_, index) =>
      referenceAt(index),
    ),
  );
  expect(trace).toEqual([
    ...Array.from({ length: REQUESTS_PER_MINUTE }, () => [
      "acquire",
      "validate",
    ]).flat(),
    "acquire",
  ]);
  expect(refused).toEqual(WAITING);
});

it("given a validation in flight for a numbering range, when a second validation is requested for that range, then the rate gate runs first and the second validation waits", async () => {
  const { rate, provider, gate } = harness(true);
  const first = gate.execute(command(RANGE_A, "ref_first"));
  const second = gate.execute(command(RANGE_A, "ref_second"));

  await vi.waitFor(() => {
    expect(provider.started).toEqual(["ref_first"]);
    expect(rate.calls).toEqual([TAX_ID, TAX_ID]);
  });

  provider.release("ref_first");

  await vi.waitFor(() => {
    expect(provider.started).toEqual(["ref_first", "ref_second"]);
  });

  provider.release("ref_second");

  await expect(first).resolves.toEqual(SENT);
  await expect(second).resolves.toEqual(SENT);
});

it("given a validation in flight for one numbering range, when another range of the same nit is requested, then both validations run together", async () => {
  const { rate, provider, gate } = harness(true);
  const first = gate.execute(command(RANGE_A, "ref_range_a"));
  const second = gate.execute(command(RANGE_B, "ref_range_b"));

  await vi.waitFor(() => {
    expect(provider.started).toEqual(["ref_range_a", "ref_range_b"]);
    expect(rate.calls).toEqual([TAX_ID, TAX_ID]);
  });

  provider.release("ref_range_a");
  provider.release("ref_range_b");

  await expect(first).resolves.toEqual(SENT);
  await expect(second).resolves.toEqual(SENT);
});
