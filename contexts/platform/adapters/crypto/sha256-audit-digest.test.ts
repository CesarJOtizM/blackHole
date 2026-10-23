import { createHash } from "node:crypto";
import { expect, it } from "vitest";

import { Sha256AuditDigest } from "#adapters/crypto/sha256-audit-digest.js";
import type { AuditDigestInput } from "#application/ports/audit-digest.js";

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortKeys(source[key]);
    }

    return sorted;
  }

  return value;
};

it("given an audit payload, when it is digested, then the hash is SHA-256 of sorted-key UTF-8 JSON without whitespace and includes previousHash", async () => {
  const digest = new Sha256AuditDigest();
  const input: AuditDigestInput = {
    siteId: "organization_venue_1",
    reason: "customer left",
    previousHash: "0".repeat(64),
    before: { amount: 20_000, tax: { rate: 19, code: "iva" } },
    after: { note: "cleared", amount: 0 },
    action: "sale.void-account",
    sequence: 1,
    occurredAt: 1_700_000_100_000,
    entity: "check_1",
    deviceId: "device_phone_1",
    authorizerId: null,
    actorId: "user_cashier",
  };
  const canonical = JSON.stringify(sortKeys(input));
  const expected = createHash("sha256").update(canonical, "utf8").digest("hex");

  const actual = await digest.digest(input);

  expect(canonical).not.toMatch(/:\s/);
  expect(canonical).not.toMatch(/,\s/);
  expect(canonical).not.toMatch(/\n/);
  expect(canonical).toContain(`"previousHash":"${"0".repeat(64)}"`);
  expect(canonical.indexOf('"action"')).toBeLessThan(
    canonical.indexOf('"actorId"'),
  );
  expect(canonical.indexOf('"code"')).toBeLessThan(canonical.indexOf('"rate"'));
  expect(actual).toBe(expected);
  expect(actual).toMatch(/^[0-9a-f]{64}$/);
});
