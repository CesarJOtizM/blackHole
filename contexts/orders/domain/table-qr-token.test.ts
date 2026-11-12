import { createHash } from "node:crypto";
import { expect, it } from "vitest";

import { TableQrToken } from "#domain/table-qr-token.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const FIRST_NONCE = "table-qr-nonce-0001";
const NEXT_NONCE = "table-qr-nonce-0002";
const PAST = "1990-01-01T00:00:00.000Z";
const FUTURE = "2099-12-31T23:59:59.000Z";

const digestOf = (plaintext: string): string =>
  createHash("sha256").update(plaintext).digest("hex");

const issue = (nonce: string) =>
  TableQrToken.issue({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    nonce,
  });

it("given a table QR, when it is rotated, then the digest changes and the old plaintext does not match", () => {
  const issued = issue(FIRST_NONCE);

  const rotated = issued.rotate(NEXT_NONCE);

  expect(issued.digest).toBe(digestOf(issued.plaintext));
  expect(rotated.digest).toBe(digestOf(rotated.plaintext));
  expect(rotated.digest).not.toBe(issued.digest);
  expect(digestOf(issued.plaintext)).not.toBe(rotated.digest);
  expect(rotated.tenantId).toBe(TENANT_ID);
  expect(rotated.venueId).toBe(VENUE_ID);
  expect(rotated.tableId).toBe(TABLE_ID);
  expect(JSON.stringify(issued)).not.toContain("check_");
});

it("given a table QR, when any instant is checked, then it has no expiry", () => {
  const issued = issue(FIRST_NONCE);

  expect(issued.isCurrent(PAST)).toBe(true);
  expect(issued.isCurrent(FUTURE)).toBe(true);
  expect("expiresAt" in issued).toBe(false);
});

it("given a table QR, when its path is read, then it is /m/ and not /f/ or /d/", () => {
  const issued = issue(FIRST_NONCE);

  expect(issued.path.startsWith("/m/")).toBe(true);
  expect(issued.path).not.toContain("/f/");
  expect(issued.path).not.toContain("/d/");
  expect(issued.path).toBe(`/m/${issued.plaintext}`);
});
