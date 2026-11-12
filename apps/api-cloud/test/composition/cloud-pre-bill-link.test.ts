import { HmacLinkSigner } from "@blackhole/invoicing/adapters/crypto/hmac-link-signer";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { expect, it } from "vitest";

import { CloudPreBillLink } from "#src/composition/cloud-pre-bill-link.js";

const INPUT = {
  tenantId: "organization_tenant_1",
  venueId: "organization_venue_1",
  checkId: "check_5",
  at: "2026-10-28T12:15:00.000Z",
};

const secrets = () =>
  new InMemorySecrets({
    "portal.link-key": "portal-link-key",
  });

it("given the portal is off, when a pre-bill link is signed, then the qr is empty", async () => {
  const link = new CloudPreBillLink(secrets(), false);

  expect(await link.sign(INPUT)).toBe("");
});

it("given the portal is on, when a pre-bill link is signed, then the qr starts with /d/ and verifies for 24 hours", async () => {
  const stored = secrets();
  const link = new CloudPreBillLink(stored, true);

  const qr = await link.sign(INPUT);

  expect(qr.startsWith("/d/")).toBe(true);
  expect(await new HmacLinkSigner(stored).verify(qr)).toEqual({
    purpose: "pre_bill",
    tenantId: INPUT.tenantId,
    venueId: INPUT.venueId,
    checkId: INPUT.checkId,
    expiresAt: "2026-10-29T12:15:00.000Z",
  });
});
