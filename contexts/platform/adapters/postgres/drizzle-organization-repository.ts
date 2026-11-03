import type { PGlite } from "@electric-sql/pglite";
import { asc, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import {
  brands,
  cashRegisters,
  inventoryLocations,
  kitchenStations,
  organizationChanges,
  organizations,
  taxpayers,
  venues,
} from "#adapters/postgres/schema.js";
import type { OrganizationChanged } from "#application/ports/organization-repository.js";
import { OrganizationRepository } from "#application/ports/organization-repository.js";
import { Organization } from "#domain/organization.js";

const VENUE_MODE = {
  CLOUD: "cloud",
} as const;

const LOCATION_KIND = {
  POINT: "point",
  WAREHOUSE: "warehouse",
} as const;

const DRAWER = {
  PRESENT: "present",
  ABSENT: "absent",
} as const;

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type CompanyRow = typeof organizations.$inferSelect;
type TaxpayerRow = typeof taxpayers.$inferSelect;
type BrandRow = typeof brands.$inferSelect;
type VenueRow = typeof venues.$inferSelect;
type LocationRow = typeof inventoryLocations.$inferSelect;
type StationRow = typeof kitchenStations.$inferSelect;
type RegisterRow = typeof cashRegisters.$inferSelect;

interface StoredTree {
  company: CompanyRow;
  taxpayers: readonly TaxpayerRow[];
  brands: readonly BrandRow[];
  venues: readonly VenueRow[];
  locations: readonly LocationRow[];
  kitchenStations: readonly StationRow[];
  cashRegisters: readonly RegisterRow[];
}

export class DrizzleOrganizationRepository extends OrganizationRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle({ client });
  }

  override async load(tenantId: string): Promise<Organization | null> {
    return this.inTenant(tenantId, async (tx) => {
      const companies = await tx.select().from(organizations);

      if (companies.length === 0) {
        return null;
      }

      if (companies.length !== 1) {
        throw new Error("Stored organization does not match the tenant.");
      }

      const company = companies[0];

      if (company === undefined || company.id !== tenantId) {
        throw new Error("Stored organization does not match the tenant.");
      }

      return restoreOrganization({
        company,
        taxpayers: await tx
          .select()
          .from(taxpayers)
          .orderBy(asc(taxpayers.position)),
        brands: await tx.select().from(brands).orderBy(asc(brands.position)),
        venues: await tx.select().from(venues).orderBy(asc(venues.position)),
        locations: await tx
          .select()
          .from(inventoryLocations)
          .orderBy(asc(inventoryLocations.position)),
        kitchenStations: await tx
          .select()
          .from(kitchenStations)
          .orderBy(asc(kitchenStations.position)),
        cashRegisters: await tx
          .select()
          .from(cashRegisters)
          .orderBy(asc(cashRegisters.position)),
      });
    });
  }

  override async save(
    organization: Organization,
    event: OrganizationChanged,
  ): Promise<void> {
    await this.inTenant(organization.id, async (tx) => {
      await deleteTree(tx, organization.id);
      await insertTree(tx, organization);
      await insertEvent(tx, organization.id, event);
    });
  }

  async eventsFor(tenantId: string): Promise<readonly OrganizationChanged[]> {
    return this.inTenant(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(organizationChanges)
        .orderBy(asc(organizationChanges.position));

      return rows.map((row) => ({
        actorId: row.actorId,
        before: row.beforeSnapshot,
        after: row.afterSnapshot,
      }));
    });
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE organization_app`);
      await tx.execute(
        sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
      );

      return work(tx);
    });
  }
}

async function deleteTree(tx: Transaction, tenantId: string): Promise<void> {
  await tx.delete(cashRegisters).where(eq(cashRegisters.tenantId, tenantId));
  await tx
    .delete(kitchenStations)
    .where(eq(kitchenStations.tenantId, tenantId));
  await tx
    .delete(inventoryLocations)
    .where(eq(inventoryLocations.tenantId, tenantId));
  await tx.delete(venues).where(eq(venues.tenantId, tenantId));
  await tx.delete(brands).where(eq(brands.tenantId, tenantId));
  await tx.delete(taxpayers).where(eq(taxpayers.tenantId, tenantId));
  await tx.delete(organizations).where(eq(organizations.tenantId, tenantId));
}

async function insertTree(
  tx: Transaction,
  organization: Organization,
): Promise<void> {
  const tenantId = organization.id;

  await tx.insert(organizations).values({
    id: tenantId,
    tenantId,
    name: organization.name,
  });

  const taxpayerRows = organization.taxpayers.map((taxpayer, position) => ({
    id: taxpayer.id,
    tenantId,
    companyId: tenantId,
    nit: taxpayer.nit,
    taxProfileId: taxpayer.taxProfileId,
    position,
  }));

  if (taxpayerRows.length > 0) {
    await tx.insert(taxpayers).values(taxpayerRows);
  }

  const brandRows = organization.brands.map((brand, position) => ({
    id: brand.id,
    tenantId,
    companyId: tenantId,
    name: brand.name,
    position,
  }));

  if (brandRows.length > 0) {
    await tx.insert(brands).values(brandRows);
  }

  const venueRows = organization.venues.map((venue, position) => ({
    id: venue.id,
    tenantId,
    companyId: tenantId,
    name: venue.name,
    brandId: venue.brandId,
    invoicingTaxpayerId: venue.invoicingTaxpayerId,
    mode: venue.mode,
    position,
  }));

  if (venueRows.length > 0) {
    await tx.insert(venues).values(venueRows);
  }

  const locationRows = organization.locations.map((location, position) => ({
    id: location.id,
    tenantId,
    companyId: tenantId,
    name: location.name,
    kind: location.kind,
    venueId: location.venueId,
    position,
  }));

  if (locationRows.length > 0) {
    await tx.insert(inventoryLocations).values(locationRows);
  }

  const stationRows = organization.kitchenStations.map((station, position) => ({
    id: station.id,
    tenantId,
    venueId: station.venueId,
    name: station.name,
    printerId: station.printerId,
    position,
  }));

  if (stationRows.length > 0) {
    await tx.insert(kitchenStations).values(stationRows);
  }

  const registerRows = organization.cashRegisters.map((register, position) => ({
    id: register.id,
    tenantId,
    venueId: register.venueId,
    name: register.name,
    drawer: register.drawer,
    printerId: register.printerId,
    position,
  }));

  if (registerRows.length > 0) {
    await tx.insert(cashRegisters).values(registerRows);
  }
}

async function insertEvent(
  tx: Transaction,
  tenantId: string,
  event: OrganizationChanged,
): Promise<void> {
  const existing = await tx
    .select({ position: organizationChanges.position })
    .from(organizationChanges);

  await tx.insert(organizationChanges).values({
    id: `${tenantId}:${existing.length}`,
    tenantId,
    position: existing.length,
    actorId: event.actorId,
    beforeSnapshot: event.before,
    afterSnapshot: event.after,
  });
}

function storedDrawer(value: string): "present" | "absent" {
  if (value === DRAWER.PRESENT || value === DRAWER.ABSENT) {
    return value;
  }

  throw new Error("Stored drawer is not supported.");
}

function restoreOrganization(stored: StoredTree): Organization {
  const organization = Organization.registerCompany({
    id: stored.company.id,
    name: stored.company.name,
  });

  for (const taxpayer of stored.taxpayers) {
    organization.addTaxpayer({
      id: taxpayer.id,
      nit: taxpayer.nit,
      taxProfileId: taxpayer.taxProfileId,
    });
  }

  for (const brand of stored.brands) {
    organization.addBrand({
      id: brand.id,
      name: brand.name,
    });
  }

  const venuesById = new Map(stored.venues.map((venue) => [venue.id, venue]));
  const openedVenueIds = new Set<string>();

  for (const location of stored.locations) {
    restoreLocation(organization, location, venuesById, openedVenueIds);
  }

  if (openedVenueIds.size !== stored.venues.length) {
    throw new Error("Stored venue is missing its point.");
  }

  for (const station of stored.kitchenStations) {
    organization.addKitchenStation({
      id: station.id,
      venueId: station.venueId,
      name: station.name,
      printerId: station.printerId,
    });
  }

  for (const register of stored.cashRegisters) {
    organization.addCashRegister({
      id: register.id,
      venueId: register.venueId,
      name: register.name,
      drawer: storedDrawer(register.drawer),
      printerId: register.printerId,
    });
  }

  return organization;
}

function restoreLocation(
  organization: Organization,
  location: LocationRow,
  venuesById: ReadonlyMap<string, VenueRow>,
  openedVenueIds: Set<string>,
): void {
  if (location.kind === LOCATION_KIND.POINT) {
    openStoredVenue(organization, location, venuesById, openedVenueIds);
    return;
  }

  if (location.kind !== LOCATION_KIND.WAREHOUSE) {
    throw new Error("Stored location kind is not supported.");
  }

  if (location.venueId === null) {
    organization.addGeneralWarehouse({
      id: location.id,
      name: location.name,
    });
    return;
  }

  organization.addSiteWarehouse({
    id: location.id,
    venueId: location.venueId,
    name: location.name,
  });
}

function openStoredVenue(
  organization: Organization,
  location: LocationRow,
  venuesById: ReadonlyMap<string, VenueRow>,
  openedVenueIds: Set<string>,
): void {
  if (location.venueId === null) {
    throw new Error("Stored point is missing its venue.");
  }

  const venue = venuesById.get(location.venueId);

  if (venue === undefined) {
    throw new Error("Stored point is missing its venue.");
  }

  if (venue.mode !== VENUE_MODE.CLOUD) {
    throw new Error("Stored venue is not a cloud venue.");
  }

  if (location.name !== venue.name) {
    throw new Error("Stored point does not match its venue.");
  }

  organization.openVenue({
    id: venue.id,
    name: venue.name,
    brandId: venue.brandId,
    taxpayerId: venue.invoicingTaxpayerId,
    pointId: location.id,
  });
  openedVenueIds.add(venue.id);
}
