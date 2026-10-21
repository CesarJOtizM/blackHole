import { z } from "zod";

const STRUCTURE_COMMAND = {
  REGISTER_COMPANY: "registerCompany",
  ADD_TAXPAYER: "addTaxpayer",
  ADD_BRAND: "addBrand",
  OPEN_VENUE: "openVenue",
  REPLACE_INVOICING_TAXPAYER: "replaceInvoicingTaxpayer",
  ADD_INVOICING_TAXPAYER: "addInvoicingTaxpayer",
  ADD_KITCHEN_STATION: "addKitchenStation",
  ADD_CASH_REGISTER: "addCashRegister",
  RENAME_CASH_REGISTER: "renameCashRegister",
  ADD_SITE_WAREHOUSE: "addSiteWarehouse",
  ADD_GENERAL_WAREHOUSE: "addGeneralWarehouse",
  ADD_POINT: "addPoint",
  ASSIGN_STOCK: "assignStock",
} as const;

const VENUE_MODE = {
  CLOUD: "cloud",
} as const;

const LOCATION_KIND = {
  POINT: "point",
  WAREHOUSE: "warehouse",
} as const;

const registerCompanyCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.REGISTER_COMPANY),
  id: z.string(),
  name: z.string(),
});

const addTaxpayerCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ADD_TAXPAYER),
  id: z.string(),
  nit: z.string(),
  taxProfileId: z.string(),
});

const addBrandCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ADD_BRAND),
  id: z.string(),
  name: z.string(),
});

const openVenueCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.OPEN_VENUE),
  id: z.string(),
  name: z.string(),
  brandId: z.string(),
  taxpayerId: z.string(),
  pointId: z.string(),
});

const replaceInvoicingTaxpayerCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.REPLACE_INVOICING_TAXPAYER),
  venueId: z.string(),
  taxpayerId: z.string(),
});

const addInvoicingTaxpayerCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ADD_INVOICING_TAXPAYER),
  venueId: z.string(),
  taxpayerId: z.string(),
});

const addKitchenStationCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ADD_KITCHEN_STATION),
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
});

const addCashRegisterCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ADD_CASH_REGISTER),
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
});

const renameCashRegisterCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.RENAME_CASH_REGISTER),
  venueId: z.string(),
  registerId: z.string(),
  name: z.string(),
});

const addSiteWarehouseCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ADD_SITE_WAREHOUSE),
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
});

const addGeneralWarehouseCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ADD_GENERAL_WAREHOUSE),
  id: z.string(),
  name: z.string(),
});

const addPointCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ADD_POINT),
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
});

const assignStockCommand = z.object({
  type: z.literal(STRUCTURE_COMMAND.ASSIGN_STOCK),
  stationId: z.string(),
  quantity: z.number(),
});

const organizationTaxpayer = z.object({
  id: z.string(),
  nit: z.string(),
  taxProfileId: z.string(),
});

const organizationBrand = z.object({
  id: z.string(),
  name: z.string(),
});

const organizationVenue = z.object({
  id: z.string(),
  name: z.string(),
  brandId: z.string(),
  invoicingTaxpayerId: z.string(),
  mode: z.literal(VENUE_MODE.CLOUD),
});

const organizationLocation = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.union([
    z.literal(LOCATION_KIND.POINT),
    z.literal(LOCATION_KIND.WAREHOUSE),
  ]),
  venueId: z.string().nullable(),
});

const organizationKitchenStation = z.object({
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
});

const organizationCashRegister = z.object({
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
});

const organizationSnapshot = z.object({
  id: z.string(),
  name: z.string(),
  taxpayers: z.array(organizationTaxpayer),
  brands: z.array(organizationBrand),
  venues: z.array(organizationVenue),
  locations: z.array(organizationLocation),
  kitchenStations: z.array(organizationKitchenStation),
  cashRegisters: z.array(organizationCashRegister),
});

export const structureCommand = z.discriminatedUnion("type", [
  registerCompanyCommand,
  addTaxpayerCommand,
  addBrandCommand,
  openVenueCommand,
  replaceInvoicingTaxpayerCommand,
  addInvoicingTaxpayerCommand,
  addKitchenStationCommand,
  addCashRegisterCommand,
  renameCashRegisterCommand,
  addSiteWarehouseCommand,
  addGeneralWarehouseCommand,
  addPointCommand,
  assignStockCommand,
]);

export type StructureCommand = z.infer<typeof structureCommand>;

export const organizationChanged = z.object({
  actorId: z.string(),
  before: organizationSnapshot,
  after: organizationSnapshot,
});

export type OrganizationChanged = z.infer<typeof organizationChanged>;
