import {
  type OrganizationChanged,
  organizationChanged,
  type StructureCommand,
  structureCommand,
} from "@blackhole/contracts";
import {
  DuplicateNit,
  DuplicateOrganizationId,
  InvalidOrganizationId,
  InvoicingTaxpayerAlreadyAssigned,
  PointAlreadyOpen,
  StockNotHeld,
  UnknownOrganizationReference,
  UpdateStructure,
} from "@blackhole/platform/application/entry-port";
import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import {
  type ConfiguredPrinter,
  PrinterRepository,
  savePrinter,
} from "@blackhole/printing/application/entry-port";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

const ACTOR_HEADER = "x-actor-id";

export class StructurePrinters extends PrinterRepository {
  readonly configured: Array<{
    id: string;
    paper: ConfiguredPrinter["paper"];
    backupPrinterId: string | null;
  }> = [];

  override async save(printer: ConfiguredPrinter): Promise<void> {
    this.configured.push({
      id: printer.id,
      paper: printer.paper,
      backupPrinterId: null,
    });
  }

  override async find(id: string): Promise<ConfiguredPrinter | null> {
    const found = this.configured.find((printer) => printer.id === id);

    if (found === undefined) {
      return null;
    }

    return { id: found.id, paper: found.paper };
  }

  assignBackup(id: string, backupPrinterId: string | null): void {
    const found = this.configured.findLast((printer) => printer.id === id);

    if (found !== undefined) {
      found.backupPrinterId = backupPrinterId;
    }
  }
}

export const routePermissions = {
  "POST structure": "organization.structure",
} as const;

const DOMAIN_REJECTION = [
  DuplicateNit,
  DuplicateOrganizationId,
  InvalidOrganizationId,
  InvoicingTaxpayerAlreadyAssigned,
  PointAlreadyOpen,
  StockNotHeld,
  UnknownOrganizationReference,
] as const;

@Controller("tenants/:tenantId")
export class UpdateStructureController {
  constructor(
    @Inject(OrganizationRepository)
    private readonly organizations: OrganizationRepository,
    @Inject(StructurePrinters)
    private readonly printers: StructurePrinters,
  ) {}

  @Post("structure")
  @HttpCode(HttpStatus.OK)
  async updateStructure(
    @Param("tenantId") tenantId: string,
    @Headers(ACTOR_HEADER) actorHeader: unknown,
    @Body() body: unknown,
  ): Promise<OrganizationChanged> {
    const actorId = readActorId(actorHeader);
    const parsed = structureCommand.safeParse(body);

    if (actorId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const updateStructure = new UpdateStructure(this.organizations);

    try {
      const event = await updateStructure.execute({
        tenantId,
        actorId,
        command: parsed.data,
      });

      await this.configurePrinter(parsed.data);

      return organizationChanged.parse(event);
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
      }

      throw error;
    }
  }

  private async configurePrinter(command: StructureCommand): Promise<void> {
    const printer = printerConfiguration(command);

    if (printer === null) {
      return;
    }

    await savePrinter(this.printers, {
      id: printer.id,
      paper: printer.paper,
    });
    this.printers.assignBackup(printer.id, printer.backupPrinterId);
  }
}

function printerConfiguration(command: StructureCommand): {
  id: string;
  paper: ConfiguredPrinter["paper"];
  backupPrinterId: string | null;
} | null {
  if (
    (command.type !== "addCashRegister" &&
      command.type !== "addKitchenStation") ||
    command.printerId === undefined ||
    command.printerId === null ||
    command.paper === undefined
  ) {
    return null;
  }

  return {
    id: command.printerId,
    paper: command.paper,
    backupPrinterId: command.backupPrinterId ?? null,
  };
}

function readActorId(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}

function domainRejectionName(error: unknown): string | null {
  for (const Rejection of DOMAIN_REJECTION) {
    if (error instanceof Rejection) {
      return error.name;
    }
  }

  return null;
}
