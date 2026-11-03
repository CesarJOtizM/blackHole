import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, expect, it } from "vitest";
import { DrizzleOrganizationRepository } from "#adapters/postgres/drizzle-organization-repository.js";
import { organizationRepositoryContract } from "#application/ports/organization-repository.contract.js";
import type { OrganizationChanged } from "#application/ports/organization-repository.js";
import { Organization } from "#domain/organization.js";

const migration = readFileSync(
  fileURLToPath(new URL("./0002_organization.sql", import.meta.url)),
  "utf8",
);

const clients: PGlite[] = [];

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

organizationRepositoryContract(async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(readDrawerMigration());

  return new DrizzleOrganizationRepository(client);
});

it("given companies A and B, when organization_app selects venues without a tenant filter, then only the current tenant returns", async () => {
  const client = new PGlite();
  clients.push(client);

  await client.exec(migration);
  await client.exec(readDrawerMigration());
  await client.exec(`
    INSERT INTO venues (
      id,
      tenant_id,
      company_id,
      name,
      brand_id,
      invoicing_taxpayer_id,
      mode,
      position
    )
    VALUES
      (
        'organization_venue_a',
        'organization_company_a',
        'organization_company_a',
        'North',
        'organization_brand_a',
        'organization_taxpayer_a',
        'cloud',
        0
      ),
      (
        'organization_venue_b',
        'organization_company_b',
        'organization_company_b',
        'South',
        'organization_brand_b',
        'organization_taxpayer_b',
        'cloud',
        1
      )
  `);
  await client.exec("SET ROLE organization_app");
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [
    "organization_company_a",
  ]);

  const selected = await client.query<{ id: string }>("SELECT id FROM venues");

  expect(selected.rows.map((row) => row.id)).toEqual(["organization_venue_a"]);
});

it("given 0013_register_drawer, when the drawer columns are described, then drawer defaults to absent and printer_id is nullable", async () => {
  const drawerSql = readDrawerMigration();
  const client = await openDatabase([migration, drawerSql]);

  const columns = await client.query<DrawerColumn>(`
    SELECT table_name, column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('cash_registers', 'kitchen_stations')
      AND column_name IN ('drawer', 'printer_id')
  `);
  const foreignKeys = await client.query<{ constraint_name: string }>(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND constraint_type = 'FOREIGN KEY'
      AND table_name IN ('cash_registers', 'kitchen_stations')
  `);

  expect(drawerSql).not.toMatch(/create\s+role/i);
  expect(columnsByName(columns.rows)).toEqual({
    "cash_registers.drawer": {
      column_default: "'absent'::text",
      is_nullable: "NO",
    },
    "cash_registers.printer_id": {
      column_default: null,
      is_nullable: "YES",
    },
    "kitchen_stations.printer_id": {
      column_default: null,
      is_nullable: "YES",
    },
  });
  expect(foreignKeys.rows).toEqual([]);
});

it("given a register row written before the drawer columns, when 0013_register_drawer runs, then reload stores absent and a null printer", async () => {
  const client = await openDatabase([migration]);
  await client.exec(`
    INSERT INTO organizations (id, tenant_id, name)
    VALUES (
      'organization_company_legacy',
      'organization_company_legacy',
      'Legacy'
    );
    INSERT INTO taxpayers (
      id, tenant_id, company_id, nit, tax_profile_id, position
    )
    VALUES (
      'organization_taxpayer_legacy',
      'organization_company_legacy',
      'organization_company_legacy',
      '900000009',
      'profile-legacy',
      0
    );
    INSERT INTO brands (id, tenant_id, company_id, name, position)
    VALUES (
      'organization_brand_legacy',
      'organization_company_legacy',
      'organization_company_legacy',
      'Brand',
      0
    );
    INSERT INTO venues (
      id,
      tenant_id,
      company_id,
      name,
      brand_id,
      invoicing_taxpayer_id,
      mode,
      position
    )
    VALUES (
      'organization_venue_legacy',
      'organization_company_legacy',
      'organization_company_legacy',
      'North',
      'organization_brand_legacy',
      'organization_taxpayer_legacy',
      'cloud',
      0
    );
    INSERT INTO inventory_locations (
      id, tenant_id, company_id, name, kind, venue_id, position
    )
    VALUES (
      'organization_point_legacy',
      'organization_company_legacy',
      'organization_company_legacy',
      'North',
      'point',
      'organization_venue_legacy',
      0
    );
    INSERT INTO kitchen_stations (id, tenant_id, venue_id, name, position)
    VALUES (
      'organization_station_legacy',
      'organization_company_legacy',
      'organization_venue_legacy',
      'Grill',
      0
    );
    INSERT INTO cash_registers (id, tenant_id, venue_id, name, position)
    VALUES (
      'organization_register_legacy',
      'organization_company_legacy',
      'organization_venue_legacy',
      'Front',
      0
    );
  `);

  await client.exec(readDrawerMigration());
  const loaded = await new DrizzleOrganizationRepository(client).load(
    "organization_company_legacy",
  );

  expect(loaded).toBeInstanceOf(Organization);
  if (!(loaded instanceof Organization)) {
    return;
  }
  expect(loaded.kitchenStations).toEqual([
    {
      id: "organization_station_legacy",
      venueId: "organization_venue_legacy",
      name: "Grill",
      printerId: null,
    },
  ]);
  expect(loaded.cashRegisters).toEqual([
    {
      id: "organization_register_legacy",
      venueId: "organization_venue_legacy",
      name: "Front",
      drawer: "absent",
      printerId: null,
    },
  ]);
});

it("given a present drawer and a printer id, when the register and the station are saved, then both round-trip", async () => {
  const client = await openDatabase([migration, readDrawerMigration()]);
  const repository = new DrizzleOrganizationRepository(client);
  const organization = registerWithDrawer();

  await repository.save(organization, savedEvent(organization));
  const loaded = await repository.load(organization.id);

  expect(loaded).toBeInstanceOf(Organization);
  if (!(loaded instanceof Organization)) {
    return;
  }
  expect(loaded.kitchenStations).toEqual([
    {
      id: "organization_station_drawer",
      venueId: "organization_venue_drawer",
      name: "Grill",
      printerId: "printer-grill",
    },
  ]);
  expect(loaded.cashRegisters).toEqual([
    {
      id: "organization_register_drawer",
      venueId: "organization_venue_drawer",
      name: "Front",
      drawer: "present",
      printerId: "printer-front",
    },
  ]);
});

interface DrawerColumn {
  table_name: string;
  column_name: string;
  column_default: string | null;
  is_nullable: string;
}

function readDrawerMigration(): string {
  return readFileSync(
    fileURLToPath(new URL("./0013_register_drawer.sql", import.meta.url)),
    "utf8",
  );
}

async function openDatabase(sqlFiles: readonly string[]): Promise<PGlite> {
  const client = new PGlite();
  clients.push(client);

  for (const sqlFile of sqlFiles) {
    await client.exec(sqlFile);
  }

  return client;
}

function columnsByName(
  rows: readonly DrawerColumn[],
): Record<string, { column_default: string | null; is_nullable: string }> {
  return Object.fromEntries(
    rows.map((row) => [
      `${row.table_name}.${row.column_name}`,
      {
        column_default: row.column_default,
        is_nullable: row.is_nullable,
      },
    ]),
  );
}

function registerWithDrawer(): Organization {
  const organization = Organization.registerCompany({
    id: "organization_company_drawer",
    name: "Drawer",
  });

  organization.addTaxpayer({
    id: "organization_taxpayer_drawer",
    nit: "900000009",
    taxProfileId: "profile-drawer",
  });
  organization.addBrand({
    id: "organization_brand_drawer",
    name: "Brand",
  });
  organization.openVenue({
    id: "organization_venue_drawer",
    name: "North",
    brandId: "organization_brand_drawer",
    taxpayerId: "organization_taxpayer_drawer",
    pointId: "organization_point_drawer",
  });
  organization.addKitchenStation({
    id: "organization_station_drawer",
    venueId: "organization_venue_drawer",
    name: "Grill",
    printerId: "printer-grill",
  });
  organization.addCashRegister({
    id: "organization_register_drawer",
    venueId: "organization_venue_drawer",
    name: "Front",
    drawer: "present",
    printerId: "printer-front",
  });

  return organization;
}

function savedEvent(organization: Organization): OrganizationChanged {
  return {
    actorId: "actor-1",
    before: {
      id: "",
      name: "",
      taxpayers: [],
      brands: [],
      venues: [],
      locations: [],
      kitchenStations: [],
      cashRegisters: [],
    },
    after: {
      id: organization.id,
      name: organization.name,
      taxpayers: organization.taxpayers,
      brands: organization.brands,
      venues: organization.venues,
      locations: organization.locations,
      kitchenStations: organization.kitchenStations,
      cashRegisters: organization.cashRegisters,
    },
  };
}
