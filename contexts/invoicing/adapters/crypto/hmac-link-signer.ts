import { createHmac, timingSafeEqual } from "node:crypto";

import type { Secrets } from "@blackhole/platform/application/entry-port";

import { CodeDigest } from "#application/ports/code-digest.js";
import {
  LinkSigner,
  type SignedPortalLink,
} from "#application/ports/link-signer.js";
import {
  type EvaluatedPortalLink,
  PORTAL_LINK_PURPOSE,
  type PortalLinkPurpose,
} from "#domain/portal-link.js";

export const PORTAL_LINK_KEY = "portal.link-key";

export class PortalLinkKeyUnavailable extends Error {
  constructor() {
    super("The portal link key is missing.");
    this.name = "PortalLinkKeyUnavailable";
  }
}

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

const safeEqual = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return timingSafeEqual(leftBytes, rightBytes);
};

const readKey = async (secrets: Secrets): Promise<string> => {
  try {
    const value = (await secrets.read(PORTAL_LINK_KEY)).trim();

    if (value.length === 0) {
      throw new PortalLinkKeyUnavailable();
    }

    return value;
  } catch (caught) {
    if (caught instanceof PortalLinkKeyUnavailable) {
      throw caught;
    }

    throw new PortalLinkKeyUnavailable();
  }
};

const readPurpose = (value: unknown): PortalLinkPurpose | null => {
  if (
    value === PORTAL_LINK_PURPOSE.PRE_BILL ||
    value === PORTAL_LINK_PURPOSE.INVOICE
  ) {
    return value;
  }

  return null;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const readLink = (payload: string): EvaluatedPortalLink | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const purpose = readPurpose(record.purpose);
  const tenantId = text(record.tenantId);
  const venueId = text(record.venueId);
  const checkId = text(record.checkId);
  const exp = text(record.exp);

  if (
    purpose === null ||
    tenantId === null ||
    venueId === null ||
    checkId === null ||
    exp === null
  ) {
    return null;
  }

  return {
    purpose,
    tenantId,
    venueId,
    checkId,
    expiresAt: exp,
  };
};

const splitSuffix = (
  token: string,
): { payload: string; mac: string } | null => {
  if (!token.startsWith("/f/")) {
    return null;
  }

  const rest = token.slice("/f/".length);
  const dot = rest.lastIndexOf(".");

  if (dot <= 0 || dot === rest.length - 1) {
    return null;
  }

  return {
    payload: rest.slice(0, dot),
    mac: rest.slice(dot + 1),
  };
};

export class HmacLinkSigner extends LinkSigner {
  constructor(private readonly secrets: Secrets) {
    super();
  }

  override async sign(link: EvaluatedPortalLink): Promise<SignedPortalLink> {
    const key = await readKey(this.secrets);
    const payload = payloadOf(link);

    return { token: `/f/${payload}.${hmac(key, payload)}` };
  }

  override async verify(token: string): Promise<EvaluatedPortalLink | null> {
    try {
      const key = await readKey(this.secrets);
      const parts = splitSuffix(token);

      if (parts === null || !safeEqual(hmac(key, parts.payload), parts.mac)) {
        return null;
      }

      return readLink(parts.payload);
    } catch {
      return null;
    }
  }
}

export class HmacCodeDigest extends CodeDigest {
  private constructor(private readonly key: string) {
    super();
  }

  static async open(secrets: Secrets): Promise<HmacCodeDigest> {
    return new HmacCodeDigest(await readKey(secrets));
  }

  override matches(code: string, digest: string): boolean {
    if (code.length === 0 || digest.length === 0) {
      return false;
    }

    return safeEqual(hmac(this.key, code), digest);
  }
}
