import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll } from "vitest";
import { FakeClock } from "#adapters/memory/fast-identity-doubles.js";
import { DrizzlePendingIssuance } from "#adapters/postgres/drizzle-pending-issuance.js";
import { pendingIssuanceContract } from "#application/ports/pending-issuance.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0005_provider_rate.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

pendingIssuanceContract(async (now) => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration);
  return new DrizzlePendingIssuance(client, new FakeClock(now));
});
