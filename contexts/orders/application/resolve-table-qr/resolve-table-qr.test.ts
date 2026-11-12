import { expect, it } from "vitest";
import { InMemoryTableQrRepository } from "#adapters/memory/in-memory-table-qr-repository.js";
import {
  ResolveTableQr,
  TableQrDisabled,
  TableQrRetired,
} from "#application/resolve-table-qr/resolve-table-qr.js";
import { TableQrToken } from "#domain/table-qr-token.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const TABLE_ID = "table_5";
const NONCE = "table-qr-nonce-0001";

const issued = () =>
  TableQrToken.issue({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    nonce: NONCE,
  });

it("given an active table QR, when it is resolved, then the site and table ids are returned", async () => {
  const tokens = new InMemoryTableQrRepository();
  const token = issued();
  await tokens.save({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    digest: token.digest,
    retired: false,
  });
  const resolve = new ResolveTableQr(tokens);

  const resolved = await resolve.execute({ token: token.plaintext });

  expect(resolved).toEqual({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
  });
});

it("given a reprinted table QR, when the old token is resolved, then it is refused", async () => {
  const tokens = new InMemoryTableQrRepository();
  const token = issued();
  await tokens.save({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    digest: token.digest,
    retired: true,
  });
  const resolve = new ResolveTableQr(tokens);

  await expect(resolve.execute({ token: token.plaintext })).rejects.toThrow(
    TableQrRetired,
  );
});

it("given table QR ordering disabled, when the token is resolved, then it is refused", async () => {
  const tokens = new InMemoryTableQrRepository();
  const token = issued();
  await tokens.save({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    tableId: TABLE_ID,
    digest: token.digest,
    retired: false,
  });
  await tokens.saveSettings({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    enabled: false,
    acceptance: "direct",
    staleAfterSeconds: 900,
  });
  const resolve = new ResolveTableQr(tokens);

  await expect(resolve.execute({ token: token.plaintext })).rejects.toThrow(
    TableQrDisabled,
  );
});
