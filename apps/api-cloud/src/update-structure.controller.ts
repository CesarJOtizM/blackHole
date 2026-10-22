import {
  type OrganizationChanged,
  organizationChanged,
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

      return organizationChanged.parse(event);
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
      }

      throw error;
    }
  }
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
