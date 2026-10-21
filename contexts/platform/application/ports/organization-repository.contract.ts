import { expect, it } from "vitest";
import type {
  OrganizationChanged,
  OrganizationRepository,
  OrganizationSnapshot,
} from "#application/ports/organization-repository.js";
import { Organization, PointAlreadyOpen } from "#domain/organization.js";

export type OrganizationRepositorySubject = OrganizationRepository & {
  eventsFor(tenantId: string): Promise<readonly OrganizationChanged[]>;
};

const snapshotOf = (organization: Organization): OrganizationSnapshot => ({
  id: organization.id,
  name: organization.name,
  taxpayers: organization.taxpayers,
  brands: organization.brands,
  venues: organization.venues,
  locations: organization.locations,
  kitchenStations: organization.kitchenStations,
  cashRegisters: organization.cashRegisters,
});

const changed = (
  actorId: string,
  organization: Organization,
): OrganizationChanged => ({
  actorId,
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
  after: snapshotOf(organization),
});

const storedOrganization = (suffix: string, venueName: string) => {
  const organization = Organization.registerCompany({
    id: `organization_company_${suffix}`,
    name: `Company ${suffix}`,
  });

  organization.addTaxpayer({
    id: `organization_taxpayer_${suffix}`,
    nit: `90000000${suffix}`,
    taxProfileId: `profile-${suffix}`,
  });
  organization.addBrand({
    id: `organization_brand_${suffix}`,
    name: `Brand ${suffix}`,
  });
  organization.openVenue({
    id: `organization_venue_${suffix}`,
    name: venueName,
    brandId: `organization_brand_${suffix}`,
    taxpayerId: `organization_taxpayer_${suffix}`,
    pointId: `organization_point_${suffix}`,
  });
  organization.addKitchenStation({
    id: `organization_station_${suffix}`,
    venueId: `organization_venue_${suffix}`,
    name: "Grill",
  });
  organization.addCashRegister({
    id: `organization_register_${suffix}`,
    venueId: `organization_venue_${suffix}`,
    name: "Front",
  });
  organization.addSiteWarehouse({
    id: `organization_warehouse_site_${suffix}`,
    venueId: `organization_venue_${suffix}`,
    name: "Upstairs",
  });
  organization.addGeneralWarehouse({
    id: `organization_warehouse_general_${suffix}`,
    name: "Central",
  });

  return organization;
};

export function organizationRepositoryContract(
  createRepository: () =>
    | OrganizationRepositorySubject
    | Promise<OrganizationRepositorySubject>,
): void {
  it("given an organization and its change, when they are saved, then both can be read back", async () => {
    const repository = await createRepository();
    const organization = storedOrganization("saved", "North");
    const event = changed("actor-1", organization);
    const expected = snapshotOf(organization);

    await repository.save(organization, event);

    const stored = await repository.load(organization.id);
    expect(stored).toBeInstanceOf(Organization);
    if (!(stored instanceof Organization)) {
      return;
    }
    expect(snapshotOf(stored)).toEqual(expected);
    expect(await repository.eventsFor(organization.id)).toEqual([event]);
  });

  it("given companies A and B, when tenant A loads its organization, then only A's venues return", async () => {
    const repository = await createRepository();
    const companyA = storedOrganization("a", "North");
    const companyB = storedOrganization("b", "South");
    const eventA = changed("actor-a", companyA);
    const eventB = changed("actor-b", companyB);
    const venueB = companyB.venues[0];

    await repository.save(companyA, eventA);
    await repository.save(companyB, eventB);

    const loadedA = await repository.load(companyA.id);
    const loadedB = await repository.load(companyB.id);
    expect(loadedA).toBeInstanceOf(Organization);
    expect(loadedB).toBeInstanceOf(Organization);
    if (!(loadedA instanceof Organization)) {
      return;
    }
    if (!(loadedB instanceof Organization)) {
      return;
    }
    expect(loadedA.venues).toEqual(companyA.venues);
    expect(loadedA.venues.map((venue) => venue.id)).not.toContain(venueB?.id);
    expect(loadedB.venues).toEqual(companyB.venues);
    expect(await repository.eventsFor(companyA.id)).toEqual([eventA]);
    expect(await repository.eventsFor(companyB.id)).toEqual([eventB]);
    expect(await repository.load("organization_company_missing")).toBeNull();
  });

  it("given a venue with its point, when the organization is saved and loaded, then the venue keeps one point", async () => {
    const repository = await createRepository();
    const organization = storedOrganization("point", "North");
    const venueId = organization.venues[0]?.id;
    if (venueId === undefined) {
      throw new Error("Venue was not opened.");
    }

    await repository.save(organization, changed("actor-1", organization));

    const loaded = await repository.load(organization.id);
    expect(loaded).toBeInstanceOf(Organization);
    if (!(loaded instanceof Organization)) {
      return;
    }
    expect(
      loaded.locations.filter((location) => location.kind === "point"),
    ).toHaveLength(1);

    const addSecondPoint = () => {
      loaded.addPoint({
        id: "organization_point_extra",
        venueId,
        name: "Extra",
      });
    };

    expect(addSecondPoint).toThrow(PointAlreadyOpen);
    expect(
      loaded.locations.filter((location) => location.kind === "point"),
    ).toHaveLength(1);
  });
}
