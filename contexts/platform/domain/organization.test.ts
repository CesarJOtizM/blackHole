import { expect, it } from "vitest";

import {
  DuplicateNit,
  InvalidOrganizationId,
  InvoicingTaxpayerAlreadyAssigned,
  Organization,
  PointAlreadyOpen,
  StockNotHeld,
  UnknownOrganizationReference,
} from "#domain/organization.js";

const COMPANY_ID = "organization_company_1";
const BRAND_ID = "organization_brand_1";
const TAXPAYER_ID = "organization_taxpayer_1";
const OTHER_TAXPAYER_ID = "organization_taxpayer_2";
const VENUE_ID = "organization_venue_1";
const POINT_ID = "organization_point_1";
const GRILL_ID = "organization_station_grill";
const BAR_STATION_ID = "organization_station_bar";
const FRONT_REGISTER_ID = "organization_register_front";
const BAR_REGISTER_ID = "organization_register_bar";
const CARD_REGISTER_ID = "organization_register_card";
const PRINTER_GRILL = "printer-grill";
const PRINTER_FRONT = "printer-front";
const PRINTER_BAR = "printer-bar";
const PRINTER_CARD = "printer-card";
const SITE_WAREHOUSE_ID = "organization_warehouse_site";
const GENERAL_WAREHOUSE_ID = "organization_warehouse_general";

const structureOf = (organization: Organization) => ({
  id: organization.id,
  name: organization.name,
  brands: organization.brands,
  taxpayers: organization.taxpayers,
  venues: organization.venues,
  locations: organization.locations,
  kitchenStations: organization.kitchenStations,
  cashRegisters: organization.cashRegisters,
});

const registerPilot = () => {
  const organization = Organization.registerCompany({
    id: COMPANY_ID,
    name: "Pilot",
  });

  organization.addTaxpayer({
    id: TAXPAYER_ID,
    nit: "900111111",
    taxProfileId: "profile-a",
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

  return organization;
};

it("given a company, when two taxpayers with different NITs are added, then both exist with their tax profiles", () => {
  const organization = Organization.registerCompany({
    id: COMPANY_ID,
    name: "Pilot",
  });

  organization.addTaxpayer({
    id: TAXPAYER_ID,
    nit: "900111111",
    taxProfileId: "profile-a",
  });
  organization.addTaxpayer({
    id: OTHER_TAXPAYER_ID,
    nit: "900222222",
    taxProfileId: "profile-b",
  });

  expect(organization.id).toBe(COMPANY_ID);
  expect(organization.name).toBe("Pilot");
  expect(organization.taxpayers).toEqual([
    {
      id: TAXPAYER_ID,
      nit: "900111111",
      taxProfileId: "profile-a",
    },
    {
      id: OTHER_TAXPAYER_ID,
      nit: "900222222",
      taxProfileId: "profile-b",
    },
  ]);
});

it("given a taxpayer with NIT 900123456, when another taxpayer with the same NIT is added, then it is rejected and the first taxpayer stays", () => {
  const organization = Organization.registerCompany({
    id: COMPANY_ID,
    name: "Pilot",
  });
  organization.addTaxpayer({
    id: TAXPAYER_ID,
    nit: "900123456",
    taxProfileId: "profile-a",
  });
  const before = structureOf(organization);

  const addDuplicateNit = () => {
    organization.addTaxpayer({
      id: OTHER_TAXPAYER_ID,
      nit: "900123456",
      taxProfileId: "profile-b",
    });
  };

  expect(addDuplicateNit).toThrow(DuplicateNit);
  expect(structureOf(organization)).toEqual(before);
});

it("given a brand and a taxpayer of the same company, when a venue is opened with both, then it invoices through that taxpayer in cloud mode with one point", () => {
  const organization = registerPilot();

  expect(organization.venues).toEqual([
    {
      id: VENUE_ID,
      name: "North",
      brandId: BRAND_ID,
      invoicingTaxpayerId: TAXPAYER_ID,
      mode: "cloud",
    },
  ]);
  expect(organization.locations).toEqual([
    {
      id: POINT_ID,
      name: "North",
      kind: "point",
      venueId: VENUE_ID,
    },
  ]);
});

it("given a venue with its point, when another point is added, then it is rejected and the venue keeps one point", () => {
  const organization = registerPilot();
  const before = structureOf(organization);

  const addSecondPoint = () => {
    organization.addPoint({
      id: "organization_point_2",
      venueId: VENUE_ID,
      name: "Extra",
    });
  };

  expect(addSecondPoint).toThrow(PointAlreadyOpen);
  expect(structureOf(organization)).toEqual(before);
  expect(
    organization.locations.filter((location) => location.kind === "point"),
  ).toHaveLength(1);
});

it("given a venue with a taxpayer, when another taxpayer is attached without the replace command, then it is rejected and the venue keeps that taxpayer", () => {
  const organization = registerPilot();
  organization.addTaxpayer({
    id: OTHER_TAXPAYER_ID,
    nit: "900222222",
    taxProfileId: "profile-b",
  });
  const before = structureOf(organization);

  const attachAnotherTaxpayer = () => {
    organization.addInvoicingTaxpayer({
      venueId: VENUE_ID,
      taxpayerId: OTHER_TAXPAYER_ID,
    });
  };

  expect(attachAnotherTaxpayer).toThrow(InvoicingTaxpayerAlreadyAssigned);
  expect(structureOf(organization)).toEqual(before);
  expect(organization.venues[0]?.invoicingTaxpayerId).toBe(TAXPAYER_ID);
});

it("given a venue with a taxpayer, when the invoicing taxpayer is replaced, then the venue keeps exactly the new taxpayer", () => {
  const organization = registerPilot();
  organization.addTaxpayer({
    id: OTHER_TAXPAYER_ID,
    nit: "900222222",
    taxProfileId: "profile-b",
  });

  organization.replaceInvoicingTaxpayer({
    venueId: VENUE_ID,
    taxpayerId: OTHER_TAXPAYER_ID,
  });

  expect(organization.venues).toEqual([
    {
      id: VENUE_ID,
      name: "North",
      brandId: BRAND_ID,
      invoicingTaxpayerId: OTHER_TAXPAYER_ID,
      mode: "cloud",
    },
  ]);
  expect(organization.taxpayers).toHaveLength(2);
});

it("given a venue invoicing through one taxpayer, when replace names a taxpayer outside the company, then it is rejected and the venue keeps its taxpayer", () => {
  const organization = registerPilot();
  const before = structureOf(organization);

  const replaceWithUnknownTaxpayer = () => {
    organization.replaceInvoicingTaxpayer({
      venueId: VENUE_ID,
      taxpayerId: OTHER_TAXPAYER_ID,
    });
  };

  expect(replaceWithUnknownTaxpayer).toThrow(UnknownOrganizationReference);
  expect(structureOf(organization)).toEqual(before);
});

it("given a venue, when stations, registers, and warehouses are added, then they stay on that venue and the company", () => {
  const organization = registerPilot();

  organization.addKitchenStation({
    id: GRILL_ID,
    venueId: VENUE_ID,
    name: "Grill",
  });
  organization.addKitchenStation({
    id: BAR_STATION_ID,
    venueId: VENUE_ID,
    name: "Bar",
  });
  organization.addCashRegister({
    id: FRONT_REGISTER_ID,
    venueId: VENUE_ID,
    name: "Front",
  });
  organization.addCashRegister({
    id: BAR_REGISTER_ID,
    venueId: VENUE_ID,
    name: "Bar",
  });
  organization.renameCashRegister({
    venueId: VENUE_ID,
    registerId: FRONT_REGISTER_ID,
    name: "Host",
  });
  organization.addSiteWarehouse({
    id: SITE_WAREHOUSE_ID,
    venueId: VENUE_ID,
    name: "Upstairs",
  });
  organization.addGeneralWarehouse({
    id: GENERAL_WAREHOUSE_ID,
    name: "Central",
  });

  expect(organization.kitchenStations).toEqual([
    { id: GRILL_ID, venueId: VENUE_ID, name: "Grill", printerId: null },
    { id: BAR_STATION_ID, venueId: VENUE_ID, name: "Bar", printerId: null },
  ]);
  expect(organization.cashRegisters).toEqual([
    {
      id: FRONT_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Host",
      drawer: "absent",
      printerId: null,
    },
    {
      id: BAR_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Bar",
      drawer: "absent",
      printerId: null,
    },
  ]);
  expect(organization.locations).toEqual([
    {
      id: POINT_ID,
      name: "North",
      kind: "point",
      venueId: VENUE_ID,
    },
    {
      id: SITE_WAREHOUSE_ID,
      name: "Upstairs",
      kind: "warehouse",
      venueId: VENUE_ID,
    },
    {
      id: GENERAL_WAREHOUSE_ID,
      name: "Central",
      kind: "warehouse",
      venueId: null,
    },
  ]);
});

it("given a venue, when one register has a drawer, one names it absent, and one omits it, then the venue keeps present beside absent and each printer", () => {
  const organization = registerPilot();

  organization.addKitchenStation({
    id: GRILL_ID,
    venueId: VENUE_ID,
    name: "Grill",
    printerId: PRINTER_GRILL,
  });
  organization.addKitchenStation({
    id: BAR_STATION_ID,
    venueId: VENUE_ID,
    name: "Bar",
  });
  organization.addCashRegister({
    id: FRONT_REGISTER_ID,
    venueId: VENUE_ID,
    name: "Front",
    drawer: "present",
    printerId: PRINTER_FRONT,
  });
  organization.addCashRegister({
    id: BAR_REGISTER_ID,
    venueId: VENUE_ID,
    name: "Bar",
    drawer: "absent",
    printerId: PRINTER_BAR,
  });
  organization.addCashRegister({
    id: CARD_REGISTER_ID,
    venueId: VENUE_ID,
    name: "Card",
    printerId: PRINTER_CARD,
  });

  expect(organization.kitchenStations).toEqual([
    {
      id: GRILL_ID,
      venueId: VENUE_ID,
      name: "Grill",
      printerId: PRINTER_GRILL,
    },
    {
      id: BAR_STATION_ID,
      venueId: VENUE_ID,
      name: "Bar",
      printerId: null,
    },
  ]);
  expect(organization.cashRegisters).toEqual([
    {
      id: FRONT_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Front",
      drawer: "present",
      printerId: PRINTER_FRONT,
    },
    {
      id: BAR_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Bar",
      drawer: "absent",
      printerId: PRINTER_BAR,
    },
    {
      id: CARD_REGISTER_ID,
      venueId: VENUE_ID,
      name: "Card",
      drawer: "absent",
      printerId: PRINTER_CARD,
    },
  ]);
});

it("given a kitchen station, when stock is assigned to it, then it is rejected and the station stays unchanged", () => {
  const organization = registerPilot();
  organization.addKitchenStation({
    id: GRILL_ID,
    venueId: VENUE_ID,
    name: "Grill",
  });
  const before = structureOf(organization);

  const assignStock = () => {
    organization.assignStock({
      stationId: GRILL_ID,
      quantity: 4,
    });
  };

  expect(assignStock).toThrow(StockNotHeld);
  expect(structureOf(organization)).toEqual(before);
});

it("given a company, when an identifier omits the organization_ prefix, then it is rejected and the company stays unchanged", () => {
  const registerWithoutPrefix = () => {
    Organization.registerCompany({
      id: "company-1",
      name: "Pilot",
    });
  };

  expect(registerWithoutPrefix).toThrow(InvalidOrganizationId);

  const organization = Organization.registerCompany({
    id: COMPANY_ID,
    name: "Pilot",
  });
  const before = structureOf(organization);

  const addTaxpayer = () => {
    organization.addTaxpayer({
      id: "taxpayer-1",
      nit: "900123456",
      taxProfileId: "profile-a",
    });
  };

  expect(addTaxpayer).toThrow(InvalidOrganizationId);
  expect(structureOf(organization)).toEqual(before);
});
