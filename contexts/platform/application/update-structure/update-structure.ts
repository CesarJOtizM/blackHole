import type {
  OrganizationChanged,
  OrganizationRepository,
  OrganizationSnapshot,
} from "#application/ports/organization-repository.js";
import {
  DuplicateOrganizationId,
  Organization,
  UnknownOrganizationReference,
} from "#domain/organization.js";

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

interface RegisterCompanyCommand {
  type: typeof STRUCTURE_COMMAND.REGISTER_COMPANY;
  id: string;
  name: string;
}

interface AddTaxpayerCommand {
  type: typeof STRUCTURE_COMMAND.ADD_TAXPAYER;
  id: string;
  nit: string;
  taxProfileId: string;
}

interface AddBrandCommand {
  type: typeof STRUCTURE_COMMAND.ADD_BRAND;
  id: string;
  name: string;
}

interface OpenVenueCommand {
  type: typeof STRUCTURE_COMMAND.OPEN_VENUE;
  id: string;
  name: string;
  brandId: string;
  taxpayerId: string;
  pointId: string;
}

interface ReplaceInvoicingTaxpayerCommand {
  type: typeof STRUCTURE_COMMAND.REPLACE_INVOICING_TAXPAYER;
  venueId: string;
  taxpayerId: string;
}

interface AddInvoicingTaxpayerCommand {
  type: typeof STRUCTURE_COMMAND.ADD_INVOICING_TAXPAYER;
  venueId: string;
  taxpayerId: string;
}

interface AddVenueItemCommand {
  type:
    | typeof STRUCTURE_COMMAND.ADD_KITCHEN_STATION
    | typeof STRUCTURE_COMMAND.ADD_CASH_REGISTER
    | typeof STRUCTURE_COMMAND.ADD_SITE_WAREHOUSE;
  id: string;
  venueId: string;
  name: string;
}

interface RenameCashRegisterCommand {
  type: typeof STRUCTURE_COMMAND.RENAME_CASH_REGISTER;
  venueId: string;
  registerId: string;
  name: string;
}

interface AddGeneralWarehouseCommand {
  type: typeof STRUCTURE_COMMAND.ADD_GENERAL_WAREHOUSE;
  id: string;
  name: string;
}

interface AddPointCommand {
  type: typeof STRUCTURE_COMMAND.ADD_POINT;
  id: string;
  venueId: string;
  name: string;
}

interface AssignStockCommand {
  type: typeof STRUCTURE_COMMAND.ASSIGN_STOCK;
  stationId: string;
  quantity: number;
}

export type StructureCommand =
  | RegisterCompanyCommand
  | AddTaxpayerCommand
  | AddBrandCommand
  | OpenVenueCommand
  | ReplaceInvoicingTaxpayerCommand
  | AddInvoicingTaxpayerCommand
  | AddVenueItemCommand
  | RenameCashRegisterCommand
  | AddGeneralWarehouseCommand
  | AddPointCommand
  | AssignStockCommand;

export interface UpdateStructureInput {
  tenantId: string;
  actorId: string;
  command: StructureCommand;
}

const emptySnapshot = (): OrganizationSnapshot => ({
  id: "",
  name: "",
  taxpayers: [],
  brands: [],
  venues: [],
  locations: [],
  kitchenStations: [],
  cashRegisters: [],
});

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

const assertNever = (command: never): never => {
  throw command;
};

const applyCommand = (
  organization: Organization,
  command: StructureCommand,
): void => {
  switch (command.type) {
    case STRUCTURE_COMMAND.REGISTER_COMPANY:
      throw new DuplicateOrganizationId();
    case STRUCTURE_COMMAND.ADD_TAXPAYER:
      organization.addTaxpayer(command);
      return;
    case STRUCTURE_COMMAND.ADD_BRAND:
      organization.addBrand(command);
      return;
    case STRUCTURE_COMMAND.OPEN_VENUE:
      organization.openVenue(command);
      return;
    case STRUCTURE_COMMAND.REPLACE_INVOICING_TAXPAYER:
      organization.replaceInvoicingTaxpayer(command);
      return;
    case STRUCTURE_COMMAND.ADD_INVOICING_TAXPAYER:
      organization.addInvoicingTaxpayer(command);
      return;
    case STRUCTURE_COMMAND.ADD_KITCHEN_STATION:
      organization.addKitchenStation(command);
      return;
    case STRUCTURE_COMMAND.ADD_CASH_REGISTER:
      organization.addCashRegister(command);
      return;
    case STRUCTURE_COMMAND.RENAME_CASH_REGISTER:
      organization.renameCashRegister(command);
      return;
    case STRUCTURE_COMMAND.ADD_SITE_WAREHOUSE:
      organization.addSiteWarehouse(command);
      return;
    case STRUCTURE_COMMAND.ADD_GENERAL_WAREHOUSE:
      organization.addGeneralWarehouse(command);
      return;
    case STRUCTURE_COMMAND.ADD_POINT:
      organization.addPoint(command);
      return;
    case STRUCTURE_COMMAND.ASSIGN_STOCK:
      organization.assignStock(command);
      return;
    default:
      assertNever(command);
  }
};

export class UpdateStructure {
  constructor(private readonly organizations: OrganizationRepository) {}

  async execute(input: UpdateStructureInput): Promise<OrganizationChanged> {
    const loaded = await this.organizations.load(input.tenantId);
    const organization = loaded ?? this.openCompany(input);
    const before = loaded === null ? emptySnapshot() : snapshotOf(loaded);

    if (loaded !== null) {
      applyCommand(loaded, input.command);
    }

    const event: OrganizationChanged = {
      actorId: input.actorId,
      before,
      after: snapshotOf(organization),
    };

    await this.organizations.save(organization, event);

    return event;
  }

  private openCompany(input: UpdateStructureInput): Organization {
    const { command } = input;

    if (command.type !== STRUCTURE_COMMAND.REGISTER_COMPANY) {
      throw new UnknownOrganizationReference();
    }

    if (command.id !== input.tenantId) {
      throw new UnknownOrganizationReference();
    }

    return Organization.registerCompany({
      id: command.id,
      name: command.name,
    });
  }
}
