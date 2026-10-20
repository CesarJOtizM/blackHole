import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll } from "vitest";
import { DrizzleVenueOperationRepository } from "#adapters/postgres/drizzle-venue-operation-repository.js";
import { venueOperationRepositoryContract } from "#application/ports/venue-operation-repository.contract.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0001_venue_operation.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

venueOperationRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);

  return new DrizzleVenueOperationRepository(client);
});
