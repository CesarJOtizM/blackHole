import { expect, it } from "vitest";
import {
  type ProviderRateGate,
  providerRequestsPerMinute,
} from "#application/ports/provider-rate-gate.js";

const taxId = "900111111";
const otherTaxId = "900222222";
const at = new Date("2026-10-22T12:00:10.000Z");

export function providerRateGateContract(
  createGate: () => ProviderRateGate | Promise<ProviderRateGate>,
): void {
  it("given a tax id with no requests in the minute, when acquire runs, then the request is allowed", async () => {
    const gate = await createGate();

    const decision = await gate.acquire(taxId, at);

    expect(decision).toEqual({ allowed: true });
  });

  it("given 80 requests for one tax id in the minute, when another acquire runs, then it is refused with the seconds left in the minute", async () => {
    const gate = await createGate();

    const allowed = [];
    for (let index = 0; index < providerRequestsPerMinute; index += 1) {
      allowed.push(await gate.acquire(taxId, at));
    }
    const refused = await gate.acquire(taxId, at);

    expect(allowed).toEqual(
      Array.from({ length: providerRequestsPerMinute }, () => ({
        allowed: true,
      })),
    );
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: 50 });
  });

  it("given a caller that passes ceiling 60, when the 61st acquire runs, then it is refused with the seconds left in the minute", async () => {
    const gate = await createGate();
    const ceiling = 60;

    const allowed = [];
    for (let index = 0; index < ceiling; index += 1) {
      allowed.push(await gate.acquire(taxId, at, ceiling));
    }
    const refused = await gate.acquire(taxId, at, ceiling);

    expect(allowed).toEqual(
      Array.from({ length: ceiling }, () => ({
        allowed: true,
      })),
    );
    expect(refused).toEqual({ allowed: false, retryAfterSeconds: 50 });
  });

  it("given 80 requests in one minute, when the next minute starts, then acquire is allowed", async () => {
    const gate = await createGate();
    const firstMinute = new Date("2026-10-22T12:00:00.000Z");

    for (let index = 0; index < providerRequestsPerMinute; index += 1) {
      await gate.acquire(taxId, firstMinute);
    }
    const decision = await gate.acquire(
      taxId,
      new Date("2026-10-22T12:01:00.000Z"),
    );

    expect(decision).toEqual({ allowed: true });
  });

  it("given 80 requests for one tax id, when another tax id acquires in that minute, then that tax id is allowed", async () => {
    const gate = await createGate();

    for (let index = 0; index < providerRequestsPerMinute; index += 1) {
      await gate.acquire(taxId, at);
    }
    const decision = await gate.acquire(otherTaxId, at);

    expect(decision).toEqual({ allowed: true });
  });
}
