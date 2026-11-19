import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { InMemoryProducibleQuantityRepository } from "@blackhole/inventory/adapters/memory/in-memory-producible-quantity-repository";
import { ProposeNoRestockToday } from "@blackhole/inventory/application/entry-port";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { PostgresNoRestockMarks } from "#src/composition/application-module.js";
import {
  CloudNoRestockProposal,
  MarksProposalStore,
  ProjectedPortionSupply,
} from "#src/composition/cloud-no-restock-proposal.js";

const migration = (name: string): string =>
  readFileSync(
    fileURLToPath(
      new URL(
        `../../../../contexts/inventory/adapters/postgres/${name}`,
        import.meta.url,
      ),
    ),
    "utf8",
  );

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "organization_venue_1";
const PRODUCT_ID = "product_burger";
const AT = new Date("2026-11-19T17:00:00.000Z");

class RecordingMarks {
  saved = 0;

  save(): Promise<void> {
    this.saved += 1;
    return Promise.resolve();
  }
}

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

it("given a product whose portions cannot be covered and no-restock today is on, when it is proposed, then the no-restock list reads that proposal", async () => {
  const client = new PGlite();
  clients.push(client);
  await client.exec(migration("0001_recipe_catalog.sql"));
  await client.exec(migration("0007_no_restock_today.sql"));
  const projections = new InMemoryProducibleQuantityRepository();
  await projections.save(TENANT_ID, {
    siteId: VENUE_ID,
    productId: PRODUCT_ID,
    variantId: null,
    pointUnits: 0,
    replenishmentUnits: 0,
    limitingIngredientIds: [],
    state: "sold_out",
  });
  const marks = new PostgresNoRestockMarks(client);
  const proposal = new CloudNoRestockProposal(
    true,
    new ProposeNoRestockToday(
      new ProjectedPortionSupply(projections),
      new MarksProposalStore(marks),
      true,
    ),
  );

  await proposal.afterProduct({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: PRODUCT_ID,
    at: AT,
  });

  const listed = await new PostgresNoRestockMarks(client).list(
    TENANT_ID,
    VENUE_ID,
    AT,
  );

  expect(listed).toEqual([
    expect.objectContaining({
      productId: PRODUCT_ID,
      status: "proposed",
    }),
  ]);
});

it("given portions cannot cover and a transfer is in transit, when no-restock is proposed, then nothing is saved", async () => {
  const projections = new InMemoryProducibleQuantityRepository();
  await projections.save(TENANT_ID, {
    siteId: VENUE_ID,
    productId: PRODUCT_ID,
    variantId: null,
    pointUnits: 0,
    replenishmentUnits: 0,
    limitingIngredientIds: [],
    state: "sold_out",
  });
  const marks = new RecordingMarks();
  const proposal = new CloudNoRestockProposal(
    true,
    new ProposeNoRestockToday(
      new ProjectedPortionSupply(projections, {
        statuses: () => Promise.resolve([{ status: "in_transit" }]),
      }),
      new MarksProposalStore(marks),
      true,
    ),
  );

  await proposal.afterProduct({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: PRODUCT_ID,
    at: AT,
  });

  expect(marks.saved).toBe(0);
});
