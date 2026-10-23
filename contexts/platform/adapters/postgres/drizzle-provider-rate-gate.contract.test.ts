import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleProviderRateGate } from "#adapters/postgres/drizzle-provider-rate-gate.js";
import { providerRateGateContract } from "#application/ports/provider-rate-gate.contract.js";
import { providerRequestsPerMinute } from "#application/ports/provider-rate-gate.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0005_provider_rate.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

async function openGate(): Promise<DrizzleProviderRateGate> {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);
  return new DrizzleProviderRateGate(client);
}

providerRateGateContract(() => openGate());

it("given two callers on one database, when they acquire for the same tax id in one minute, then they share a window of 80", async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);
  const first = new DrizzleProviderRateGate(client);
  const second = new DrizzleProviderRateGate(client);
  const at = new Date("2026-10-22T12:00:10.000Z");
  const taxId = "900111111";

  for (let index = 0; index < providerRequestsPerMinute / 2; index += 1) {
    expect(await first.acquire(taxId, at)).toEqual({ allowed: true });
    expect(await second.acquire(taxId, at)).toEqual({ allowed: true });
  }
  const firstRefusal = await first.acquire(taxId, at);
  const secondRefusal = await second.acquire(taxId, at);

  expect(firstRefusal).toEqual({ allowed: false, retryAfterSeconds: 50 });
  expect(secondRefusal).toEqual({ allowed: false, retryAfterSeconds: 50 });
});
