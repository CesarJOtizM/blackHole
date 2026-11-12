import { createHmac } from "node:crypto";
import { Secrets } from "@blackhole/platform/application/entry-port";
import { expect, it } from "vitest";

import {
  HmacCodeDigest,
  HmacLinkSigner,
  PortalLinkKeyUnavailable,
} from "#adapters/crypto/hmac-link-signer.js";
import { codeDigestContract } from "#application/ports/code-digest.contract.js";
import { linkSignerContract } from "#application/ports/link-signer.contract.js";
import {
  type EvaluatedPortalLink,
  PORTAL_LINK_PURPOSE,
} from "#domain/portal-link.js";

const LINK_KEY = "secrets-portal-link-key";
const ENV_KEY = "env-portal-link-key";
const CODE = "482915";
const TENANT_ID = "tenant_north";
const VENUE_ID = "venue_center";
const CHECK_ID = "check_12";
const EXPIRES_AT = "2026-11-06T16:00:00.000Z";

class MemorySecrets extends Secrets {
  readonly reads: string[] = [];

  constructor(private readonly stored: Readonly<Record<string, string>>) {
    super();
  }

  override async read(name: string): Promise<string> {
    this.reads.push(name);
    const value = this.stored[name];

    if (value === undefined) {
      throw new Error(`Unknown secret: ${name}`);
    }

    return value;
  }
}

const configured = (): MemorySecrets =>
  new MemorySecrets({
    "portal.link-key": LINK_KEY,
  });

const invoiceLink = (): EvaluatedPortalLink => ({
  purpose: PORTAL_LINK_PURPOSE.INVOICE,
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  checkId: CHECK_ID,
  expiresAt: EXPIRES_AT,
});

const canonical = (link: EvaluatedPortalLink): string =>
  JSON.stringify({
    purpose: link.purpose,
    tenantId: link.tenantId,
    venueId: link.venueId,
    checkId: link.checkId,
    exp: link.expiresAt,
  });

const payloadOf = (link: EvaluatedPortalLink): string =>
  Buffer.from(canonical(link), "utf8").toString("base64url");

const hmac = (key: string, message: string): string =>
  createHmac("sha256", key).update(message, "utf8").digest("base64url");

const suffixOf = (key: string, link: EvaluatedPortalLink): string => {
  const payload = payloadOf(link);

  return `/f/${payload}.${hmac(key, payload)}`;
};

const flipTail = (token: string): string => {
  const tail = token.endsWith("a") ? "b" : "a";

  return `${token.slice(0, -1)}${tail}`;
};

linkSignerContract(() => ({
  signer: () => new HmacLinkSigner(configured()),
  link: invoiceLink,
}));

codeDigestContract(async () => {
  const digest = await HmacCodeDigest.open(configured());

  return {
    digest: () => digest,
    sample: () => ({
      code: CODE,
      digest: hmac(LINK_KEY, CODE),
    }),
  };
});

it("given portal.link-key, when an invoice link is signed, then the /f/ suffix is that HMAC and verify returns the link", async () => {
  const stored = configured();
  const link = invoiceLink();
  const previous = process.env["portal.link-key"];
  process.env["portal.link-key"] = ENV_KEY;

  try {
    const signed = await new HmacLinkSigner(stored).sign(link);
    const suffix = suffixOf(LINK_KEY, link);

    expect(signed.token).toBe(suffix);
    expect(signed.token.startsWith("/f/")).toBe(true);
    expect(await new HmacLinkSigner(stored).verify(suffix)).toEqual(link);
    expect(stored.reads).toEqual(["portal.link-key", "portal.link-key"]);
    expect(signed.token).not.toContain(LINK_KEY);
    expect(signed.token).not.toContain(ENV_KEY);
  } finally {
    if (previous === undefined) {
      delete process.env["portal.link-key"];
    } else {
      process.env["portal.link-key"] = previous;
    }
  }
});

it("given a matching /d/ suffix, when the pre-bill prefix replaces /f/, then verify returns the same link", async () => {
  const signer = new HmacLinkSigner(configured());
  const suffix = suffixOf(LINK_KEY, invoiceLink());
  const preBill = `/d/${suffix.slice("/f/".length)}`;

  expect(await signer.verify(preBill)).toEqual(invoiceLink());
});

it("given a matching /f/ suffix, when the payload or the hmac is changed, then verify returns null", async () => {
  const signer = new HmacLinkSigner(configured());
  const suffix = suffixOf(LINK_KEY, invoiceLink());
  const dot = suffix.lastIndexOf(".");
  const head = suffix[3] === "A" ? "B" : "A";
  const flippedPayload = `/f/${head}${suffix.slice(4)}`;

  expect(await signer.verify(suffix)).toEqual(invoiceLink());
  expect(await signer.verify(flipTail(suffix))).toBeNull();
  expect(await signer.verify(flippedPayload)).toBeNull();
  expect(await signer.verify(`${suffix}.other`)).toBeNull();
  expect(await signer.verify(suffix.slice(dot + 1))).toBeNull();
});

it("given portal.link-key is missing or blank, when a link is signed, then signing fails and verify returns null", async () => {
  const suffix = suffixOf(LINK_KEY, invoiceLink());
  const missing = new HmacLinkSigner(new MemorySecrets({}));
  const blank = new HmacLinkSigner(
    new MemorySecrets({ "portal.link-key": "  " }),
  );

  await expect(missing.sign(invoiceLink())).rejects.toBeInstanceOf(
    PortalLinkKeyUnavailable,
  );
  await expect(blank.sign(invoiceLink())).rejects.toBeInstanceOf(
    PortalLinkKeyUnavailable,
  );
  expect(await missing.verify(suffix)).toBeNull();
  expect(await blank.verify(suffix)).toBeNull();
  await expect(
    HmacCodeDigest.open(new MemorySecrets({})),
  ).rejects.toBeInstanceOf(PortalLinkKeyUnavailable);
});
