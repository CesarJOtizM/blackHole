import { expect, it, vi } from "vitest";

import { InMemoryOrganizationRepository } from "#adapters/memory/in-memory-organization-repository.js";
import { UpdateStructure } from "#application/update-structure/update-structure.js";
import {
  DuplicateNit,
  InvoicingTaxpayerAlreadyAssigned,
  Organization,
  StockNotHeld,
} from "#domain/organization.js";

const TENANT_ID = "organization_company_1";
const ACTOR_ID = "actor-1";
const BRAND_ID = "organization_brand_1";
const TAXPAYER_ID = "organization_taxpayer_1";
const OTHER_TAXPAYER_ID = "organization_taxpayer_2";
const DUPLICATE_TAXPAYER_ID = "organization_taxpayer_3";
const VENUE_ID = "organization_venue_1";
const POINT_ID = "organization_point_1";
const STATION_ID = "organization_station_grill";
const BAR_STATION_ID = "organization_station_bar";
const REGISTER_ID = "organization_register_front";
const DRAWER_REGISTER_ID = "organization_register_drawer";
const CARD_REGISTER_ID = "organization_register_card";
const QUIET_REGISTER_ID = "organization_register_quiet";
const PRINTER_BAR = "printer-bar";
const PRINTER_DRAWER = "printer-drawer";
const PRINTER_CARD = "printer-card";
const PRINTER_QUIET = "printer-quiet";

const snapshotOf = (organization: Organization) => ({
  id: organization.id,
  name: organization.name,
  taxpayers: organization.taxpayers,
  brands: organization.brands,
  venues: organization.venues,
  locations: organization.locations,
  kitchenStations: organization.kitchenStations,
  cashRegisters: organization.cashRegisters,
});

const pilotOrganization = () => {
  const organization = Organization.registerCompany({
    id: TENANT_ID,
    name: "Pilot",
  });

  organization.addTaxpayer({
    id: TAXPAYER_ID,
    nit: "900123456",
    taxProfileId: "profile-a",
  });
  organization.addTaxpayer({
    id: OTHER_TAXPAYER_ID,
    nit: "900222222",
    taxProfileId: "profile-b",
  });
  organization.addBrand({
    id: BRAND_ID,
    name: "House",
  });
  organization.openVenue({
    id: VENUE_ID,
    name: "North",
    brandId: BRAND_ID,
    taxpayerId: TAXPAYER_ID,
    pointId: POINT_ID,
  });
  organization.addKitchenStation({
    id: STATION_ID,
    venueId: VENUE_ID,
    name: "Grill",
  });
  organization.addCashRegister({
    id: REGISTER_ID,
    venueId: VENUE_ID,
    name: "Front",
  });

  return organization;
};

const storePilot = async (repository: InMemoryOrganizationRepository) => {
  const organization = pilotOrganization();
  const snapshot = snapshotOf(organization);

  await repository.save(organization, {
    actorId: "actor-seed",
    before: snapshot,
    after: snapshot,
  });
};

it("given a register, when an administrator renames it, then an OrganizationChanged event records the actor and the names before and after", async () => {
  const repository = new InMemoryOrganizationRepository();
  const updateStructure = new UpdateStructure(repository);
  await storePilot(repository);
  const save = vi.spyOn(repository, "save");

  const event = await updateStructure.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    command: {
      type: "renameCashRegister",
      venueId: VENUE_ID,
      registerId: REGISTER_ID,
      name: "Host",
    },
  });

  expect(event.actorId).toBe(ACTOR_ID);
  expect(event.before.cashRegisters).toEqual([
    {
      id: REGISTER_ID,
      venueId: VENUE_ID,
      name: "Front",
      drawer: "absent",
      printerId: null,
    },
  ]);
  expect(event.after.cashRegisters).toEqual([
    {
      id: REGISTER_ID,
      venueId: VENUE_ID,
      name: "Host",
      drawer: "absent",
      printerId: null,
    },
  ]);
  expect(save).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledWith(expect.any(Organization), event);
  const stored = await repository.load(TENANT_ID);
  expect(stored?.cashRegisters).toEqual([
    {
      id: REGISTER_ID,
      venueId: VENUE_ID,
      name: "Host",
      drawer: "absent",
      printerId: null,
    },
  ]);
  expect(await repository.eventsFor(TENANT_ID)).toContainEqual(event);
});

it("given a venue, when a station and registers are added with and without a drawer, then a missing drawer is stored absent beside a present one and each printer", async () => {
  const repository = new InMemoryOrganizationRepository();
  const updateStructure = new UpdateStructure(repository);
  await storePilot(repository);

  await updateStructure.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    command: {
      type: "addKitchenStation",
      id: BAR_STATION_ID,
      venueId: VENUE_ID,
      name: "Bar",
      printerId: PRINTER_BAR,
    },
  });
  await updateStructure.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    command: {
      type: "addCashRegister",
      id: DRAWER_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Drawer",
      drawer: "present",
      printerId: PRINTER_DRAWER,
    },
  });
  await updateStructure.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    command: {
      type: "addCashRegister",
      id: CARD_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Card",
      drawer: "absent",
      printerId: PRINTER_CARD,
    },
  });
  const event = await updateStructure.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    command: {
      type: "addCashRegister",
      id: QUIET_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Quiet",
      printerId: PRINTER_QUIET,
    },
  });

  expect(event.after.kitchenStations).toEqual([
    {
      id: STATION_ID,
      venueId: VENUE_ID,
      name: "Grill",
      printerId: null,
    },
    {
      id: BAR_STATION_ID,
      venueId: VENUE_ID,
      name: "Bar",
      printerId: PRINTER_BAR,
    },
  ]);
  expect(event.after.cashRegisters).toEqual([
    {
      id: REGISTER_ID,
      venueId: VENUE_ID,
      name: "Front",
      drawer: "absent",
      printerId: null,
    },
    {
      id: DRAWER_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Drawer",
      drawer: "present",
      printerId: PRINTER_DRAWER,
    },
    {
      id: CARD_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Card",
      drawer: "absent",
      printerId: PRINTER_CARD,
    },
    {
      id: QUIET_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Quiet",
      drawer: "absent",
      printerId: PRINTER_QUIET,
    },
  ]);
  const stored = await repository.load(TENANT_ID);
  expect(stored?.kitchenStations).toEqual(event.after.kitchenStations);
  expect(stored?.cashRegisters).toEqual(event.after.cashRegisters);
});

it("given a venue with a taxpayer, when another taxpayer is attached without replace, then save is not called and nothing is emitted", async () => {
  const repository = new InMemoryOrganizationRepository();
  const updateStructure = new UpdateStructure(repository);
  await storePilot(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const stored = await repository.load(TENANT_ID);
  const before = stored === null ? null : snapshotOf(stored);
  const save = vi.spyOn(repository, "save");

  const attachAnotherTaxpayer = updateStructure.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    command: {
      type: "addInvoicingTaxpayer",
      venueId: VENUE_ID,
      taxpayerId: OTHER_TAXPAYER_ID,
    },
  });

  await expect(attachAnotherTaxpayer).rejects.toThrow(
    InvoicingTaxpayerAlreadyAssigned,
  );
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  const after = await repository.load(TENANT_ID);
  expect(after === null ? null : snapshotOf(after)).toEqual(before);
  expect(after?.venues[0]?.invoicingTaxpayerId).toBe(TAXPAYER_ID);
});

it("given a kitchen station, when stock is assigned to it, then save is not called and nothing is emitted", async () => {
  const repository = new InMemoryOrganizationRepository();
  const updateStructure = new UpdateStructure(repository);
  await storePilot(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const stored = await repository.load(TENANT_ID);
  const before = stored === null ? null : snapshotOf(stored);
  const save = vi.spyOn(repository, "save");

  const assignStock = updateStructure.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    command: {
      type: "assignStock",
      stationId: STATION_ID,
      quantity: 4,
    },
  });

  await expect(assignStock).rejects.toThrow(StockNotHeld);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  const after = await repository.load(TENANT_ID);
  expect(after === null ? null : snapshotOf(after)).toEqual(before);
});

it("given a taxpayer with NIT 900123456, when another taxpayer with the same NIT is added, then save is not called and nothing is emitted", async () => {
  const repository = new InMemoryOrganizationRepository();
  const updateStructure = new UpdateStructure(repository);
  await storePilot(repository);
  const recorded = await repository.eventsFor(TENANT_ID);
  const stored = await repository.load(TENANT_ID);
  const before = stored === null ? null : snapshotOf(stored);
  const save = vi.spyOn(repository, "save");

  const addDuplicateNit = updateStructure.execute({
    tenantId: TENANT_ID,
    actorId: ACTOR_ID,
    command: {
      type: "addTaxpayer",
      id: DUPLICATE_TAXPAYER_ID,
      nit: "900123456",
      taxProfileId: "profile-c",
    },
  });

  await expect(addDuplicateNit).rejects.toThrow(DuplicateNit);
  expect(save).not.toHaveBeenCalled();
  expect(await repository.eventsFor(TENANT_ID)).toEqual(recorded);
  const after = await repository.load(TENANT_ID);
  expect(after === null ? null : snapshotOf(after)).toEqual(before);
  expect(after?.taxpayers).toHaveLength(2);
});

it("given the application entry port, when it is imported, then it exposes UpdateStructure", async () => {
  const entry = await import("#application/entry-port.js");

  expect(entry.UpdateStructure).toBe(UpdateStructure);
});
