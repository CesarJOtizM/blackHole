import { createHash } from "node:crypto";

import type { AuditDigestInput } from "#application/ports/audit-digest.js";
import { AuditDigest } from "#application/ports/audit-digest.js";

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(source).sort()) {
      sorted[key] = canonical(source[key]);
    }

    return sorted;
  }

  return value;
};

export class Sha256AuditDigest extends AuditDigest {
  override async digest(input: AuditDigestInput): Promise<string> {
    const encoded = JSON.stringify(canonical(input));

    return createHash("sha256").update(encoded, "utf8").digest("hex");
  }
}
