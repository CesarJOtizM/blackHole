import { expect, it } from "vitest";

import { InMemoryOrganizationRepository } from "#adapters/memory/in-memory-organization-repository.js";
import {
  DeclareWarehouseSupply,
  UnlinkedWarehouse,
  type WarehouseSupplyLink,
  WarehouseSupplyStore,
} from "#application/declare-warehouse-supply/declare-warehouse-supply.js";
import { Organization } from "#domain/organization.js";

const TENANT_ID = "organization_company_1";
const OTHER_TENANT_ID = "organization_company_2";
const VENUE_A = "organization_venue_a";
const VENUE_B = "organization_venue_b";
const POINT_A = "organization_point_a";
const POINT_B = "organization_point_b";
const NORTH_ID = "organization_warehouse_north";
const CENTRAL_ID = "organization_warehouse_central";
const TAXPAYER_ID = "organization_taxpayer_1";
const BRAND_ID = "organization_brand_1";

class MemoryWarehouseSupplyStore extends WarehouseSupplyStore {
  readonly links: WarehouseSupplyLink[] = [];

  save(link: WarehouseSupplyLink): Promise<void> {
    this.links.push({ ...link });
    return Promise.resolve();
  }

  find(
    tenantId: string,
    venueId: string,
    warehouseLocationId: string,
  ): Promise<WarehouseSupplyLink | null> {
    return Promise.resolve(
      this.links.find(
        (link) =>
          link.tenantId === tenantId &&
          link.venueId === venueId &&
          link.warehouseLocationId === warehouseLocationId,
      ) ?? null,
    );
  }
}

const company = (): Organization => {
  const organization = Organization.registerCompany({
    id: TENANT_ID,
    name: "Pilot",
  });
  organization.addTaxpayer({
    id: TAXPAYER_ID,
    nit: "900123456",
    taxProfileId: "profile-a",
  });
  organization.addBrand({ id: BRAND_ID, name: "House" });
  organization.openVenue({
    id: VENUE_A,
    name: "Site A",
    brandId: BRAND_ID,
    taxpayerId: TAXPAYER_ID,
    pointId: POINT_A,
  });
  organization.openVenue({
    id: VENUE_B,
    name: "Site B",
    brandId: BRAND_ID,
    taxpayerId: TAXPAYER_ID,
    pointId: POINT_B,
  });
  organization.addSiteWarehouse({
    id: NORTH_ID,
    venueId: VENUE_B,
    name: "North",
  });
  organization.addGeneralWarehouse({
    id: CENTRAL_ID,
    name: "Central",
  });

  return organization;
};

const harness = async () => {
  const organizations = new InMemoryOrganizationRepository();
  const supplies = new MemoryWarehouseSupplyStore();
  const organization = company();
  const snapshot = {
    id: organization.id,
    name: organization.name,
    taxpayers: organization.taxpayers,
    brands: organization.brands,
    venues: organization.venues,
    locations: organization.locations,
    kitchenStations: organization.kitchenStations,
    cashRegisters: organization.cashRegisters,
  };
  await organizations.save(organization, {
    actorId: "actor-seed",
    before: snapshot,
    after: snapshot,
  });

  return {
    supplies,
    declareWarehouseSupply: new DeclareWarehouseSupply(organizations, supplies),
  };
};

it("given North is a warehouse of another site, when site A declares it, then the unlinked warehouse is rejected and nothing is stored", async () => {
  const { supplies, declareWarehouseSupply } = await harness();

  const pending = declareWarehouseSupply.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_A,
    warehouseLocationId: NORTH_ID,
  });

  await expect(pending).rejects.toBeInstanceOf(UnlinkedWarehouse);
  expect(supplies.links).toEqual([]);
  expect(await supplies.find(TENANT_ID, VENUE_A, NORTH_ID)).toBeNull();
  expect(await supplies.find(OTHER_TENANT_ID, VENUE_A, NORTH_ID)).toBeNull();
});

it("given Central is the company warehouse, when site A declares it, then the supply link is stored", async () => {
  const { supplies, declareWarehouseSupply } = await harness();

  await declareWarehouseSupply.execute({
    tenantId: TENANT_ID,
    venueId: VENUE_A,
    warehouseLocationId: CENTRAL_ID,
  });

  expect(supplies.links).toEqual([
    {
      tenantId: TENANT_ID,
      venueId: VENUE_A,
      warehouseLocationId: CENTRAL_ID,
    },
  ]);
});
