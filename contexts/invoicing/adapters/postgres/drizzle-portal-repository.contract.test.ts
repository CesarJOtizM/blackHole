import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";

import { FACTUS_MUNICIPALITIES } from "#adapters/factus/factus-municipalities.js";
import {
  DrizzleMunicipalityCatalog,
  seedFactusMunicipalities,
} from "#adapters/postgres/drizzle-municipality-catalog.js";
import {
  DrizzleBillingDataStore,
  DrizzleDataDeletionStore,
  DrizzlePortalBuyerLookupStore,
  DrizzlePortalRepository,
  DrizzlePortalRequestLimiter,
  DrizzlePortalSettings,
  DrizzleReinvoiceRequestStore,
  DrizzleRememberedCodeStore,
  DrizzleRememberedContactStore,
} from "#adapters/postgres/drizzle-portal-repository.js";
import { municipalityCatalogContract } from "#application/ports/municipality-catalog.contract.js";
import { PORTAL_REINVOICE_REQUEST_STATUS } from "#application/ports/portal-repository.js";
import { portalRequestLimiterContract } from "#application/ports/portal-request-limiter.contract.js";
import type { StoredBillingData } from "#application/record-billing-data/record-billing-data.js";
import type { StoredDataDeletion } from "#application/request-data-deletion/request-data-deletion.js";
import type { StoredRememberedCode } from "#application/verify-remembered-code/verify-remembered-code.js";
import { REINVOICE_WINDOW_MODE } from "#domain/reinvoice-window.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0016_invoicing_portal.sql", import.meta.url)),
  "utf8",
);

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const DOCUMENT_TYPE = "13";
const DOCUMENT_NUMBER = "1234567890";
const BOGOTA = "11001";

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

const open = async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);

  return client;
};

const code = {
  digest: "digest-not-the-code",
  sentAt: "2026-11-13T15:00:00.000Z",
  expiresAt: "2026-11-13T15:10:00.000Z",
  attemptsRemaining: 5,
  spent: false,
};

const identity = {
  documentType: DOCUMENT_TYPE,
  documentNumber: DOCUMENT_NUMBER,
  personType: "natural",
  name: "Ada Lovelace",
  email: "ada@example.com",
  municipalityCode: BOGOTA,
};

const billing = {
  ...identity,
  consent: {
    acceptedAt: "2026-11-13T15:00:00.000Z",
    policyVersion: "2026-01",
    policyLink: "https://example.com/privacy",
  },
  deletedAt: null,
  invoiceSnapshots: [],
};

municipalityCatalogContract(async () => {
  const client = await open();
  await seedFactusMunicipalities(client);

  return {
    catalog: () => new DrizzleMunicipalityCatalog(client),
    knownCode: () => BOGOTA,
  };
});

portalRequestLimiterContract(async () => {
  const client = await open();
  const limiter = new DrizzlePortalRequestLimiter(client);

  return {
    limiter: () => limiter,
    attempt: () => ({ token: "portal-token", ip: "127.0.0.1" }),
    acquired: () => limiter.attempts,
  };
});

it("given the Factus municipality list, when it is seeded, then every published code is stored under forced row security", async () => {
  const client = await open();
  await seedFactusMunicipalities(client);
  const count = await client.query<{ count: number | string }>(
    "SELECT count(*) AS count FROM dane_municipalities",
  );
  const security = await client.query<{
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(`
    SELECT c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'dane_municipalities'
  `);

  expect(Number(count.rows[0]?.count)).toBe(FACTUS_MUNICIPALITIES.length);
  expect(security.rows).toEqual([
    { relrowsecurity: true, relforcerowsecurity: true },
  ]);
});

it("given buyers for two companies, when invoicing_app reads as the first company, then only that company returns", async () => {
  const client = await open();
  await client.exec(`
    INSERT INTO remembered_buyers (
      tenant_id, document_type, document_number, channel, destination, name
    ) VALUES
      ('${TENANT_A}', '${DOCUMENT_TYPE}', '${DOCUMENT_NUMBER}', 'email', 'a@example.com', 'Ada'),
      ('${TENANT_B}', '${DOCUMENT_TYPE}', '${DOCUMENT_NUMBER}', 'email', 'b@example.com', 'Bea');
  `);
  const store = new DrizzleRememberedContactStore(client);

  expect(await store.find(TENANT_A, DOCUMENT_TYPE, DOCUMENT_NUMBER)).toEqual({
    companyId: TENANT_A,
    documentType: DOCUMENT_TYPE,
    documentNumber: DOCUMENT_NUMBER,
    channel: "email",
    destination: "a@example.com",
    name: "Ada",
  });
  expect(
    await store.find(TENANT_B, DOCUMENT_TYPE, DOCUMENT_NUMBER),
  ).toMatchObject({ name: "Bea" });

  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    TENANT_A,
  ]);
  await client.exec("SET ROLE invoicing_app");
  const selected = await client.query<{ name: string }>(
    "SELECT name FROM remembered_buyers",
  );

  expect(selected.rows).toEqual([{ name: "Ada" }]);
});

it("given a one-time code, when it is saved, then only the digest is stored", async () => {
  const client = await open();
  const store = new DrizzleRememberedContactStore(client);

  await store.save({
    companyId: TENANT_A,
    documentType: DOCUMENT_TYPE,
    documentNumber: DOCUMENT_NUMBER,
    record: code,
  });
  const columns = await client.query<{ column_name: string }>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'one_time_codes'
  `);
  const stored = await client.query<{ digest: string }>(
    "SELECT digest FROM one_time_codes",
  );

  expect(columns.rows.map((row) => row.column_name)).not.toContain("code");
  expect(stored.rows).toEqual([{ digest: code.digest }]);
});

it("given billing data for one company, when another company reads the same check, then that check stays hidden", async () => {
  const client = await open();
  const store = new DrizzleBillingDataStore(client);
  const row: StoredBillingData = {
    companyId: TENANT_A,
    checkId: "check-1",
    record: billing,
  };

  await store.save(row);

  expect(await store.find(TENANT_A, "check-1")).toEqual(row);
  expect(await store.find(TENANT_B, "check-1")).toBeNull();
});

it("given a remembered code and a deletion record, when each is saved, then the same company can read it back", async () => {
  const client = await open();
  const codes = new DrizzleRememberedCodeStore(client);
  const deletions = new DrizzleDataDeletionStore(client);
  const remembered: StoredRememberedCode = {
    companyId: TENANT_A,
    documentType: DOCUMENT_TYPE,
    documentNumber: DOCUMENT_NUMBER,
    billing: identity,
    record: code,
  };
  const deletion: StoredDataDeletion = {
    companyId: TENANT_A,
    documentType: DOCUMENT_TYPE,
    documentNumber: DOCUMENT_NUMBER,
    billing,
    record: code,
  };

  await codes.save(remembered);
  expect(await codes.find(TENANT_A, DOCUMENT_TYPE, DOCUMENT_NUMBER)).toEqual(
    remembered,
  );
  await deletions.save(deletion);
  expect(
    await deletions.find(TENANT_A, DOCUMENT_TYPE, DOCUMENT_NUMBER),
  ).toEqual(deletion);
  expect(
    await deletions.find(TENANT_B, DOCUMENT_TYPE, DOCUMENT_NUMBER),
  ).toBeNull();
});

it("given an acquirer cache and a reinvoice request, when another company reads them, then they stay hidden", async () => {
  const client = await open();
  const lookups = new DrizzlePortalBuyerLookupStore(client);
  const requests = new DrizzleReinvoiceRequestStore(client);
  const portal = new DrizzlePortalRepository(client);
  const cached = {
    companyId: TENANT_A,
    documentType: DOCUMENT_TYPE,
    documentNumber: DOCUMENT_NUMBER,
    name: "Ada Lovelace",
    email: "ada@example.com",
    cachedAt: "2026-11-13T15:00:00.000Z",
  };
  const request = {
    companyId: TENANT_A,
    invoiceNumber: "SETP1",
    issuedAt: "2026-11-13T15:00:00.000Z",
    requestedAt: "2026-11-13T16:00:00.000Z",
    status: PORTAL_REINVOICE_REQUEST_STATUS.PENDING,
  };

  await lookups.saveCache(cached);
  await lookups.saveLookup({
    lookupId: "lookup-1",
    companyId: TENANT_A,
    documentType: DOCUMENT_TYPE,
    documentNumber: DOCUMENT_NUMBER,
    name: cached.name,
    email: cached.email,
  });
  await requests.save(request);

  expect(
    await lookups.readCache(TENANT_A, DOCUMENT_TYPE, DOCUMENT_NUMBER),
  ).toEqual(cached);
  expect(
    await lookups.readCache(TENANT_B, DOCUMENT_TYPE, DOCUMENT_NUMBER),
  ).toBeNull();
  expect(await requests.find(TENANT_A, "SETP1")).toEqual(request);
  expect(await portal.find(TENANT_A, "SETP1")).toEqual(request);
  expect(await requests.find(TENANT_B, "SETP1")).toBeNull();
});

it("given a new company, when portal settings are opened, then invoicing stays disabled and the window is the same Bogota day", async () => {
  const client = await open();
  await client.exec(
    `INSERT INTO portal_settings (tenant_id) VALUES ('${TENANT_A}')`,
  );
  const stored = await client.query<{
    enabled: boolean;
    window_mode: string;
  }>("SELECT enabled, window_mode FROM portal_settings");
  const settings = new DrizzlePortalSettings(client);

  expect(stored.rows).toEqual([
    { enabled: false, window_mode: REINVOICE_WINDOW_MODE.SAME_DAY },
  ]);
  expect(await settings.open(TENANT_A)).toEqual({
    enabled: false,
    windowMode: REINVOICE_WINDOW_MODE.SAME_DAY,
  });
});
