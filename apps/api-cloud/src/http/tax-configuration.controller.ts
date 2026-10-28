import {
  AdoptFiscalTemplate,
  type AdoptFiscalTemplateCommand,
  FiscalTemplateNotFound,
  OverlappingTaxRule,
  PublishTaxRule,
  type PublishTaxRuleCommand,
} from "@blackhole/invoicing/application/entry-port";
import {
  EvaluatePermission,
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import { z } from "zod";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST tax-rules": "tax.configure",
  "POST fiscal-profiles/adopt": "tax.configure",
} as const;

const ACTION = routePermissions["POST tax-rules"];

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const publishTaxRuleBody = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  taxClassification: z.string().min(1),
  regime: z.enum(["ordinary", "simple"]).optional(),
  vatResponsible: z.boolean().optional(),
  incResponsible: z.boolean().optional(),
  franchise: z.boolean().optional(),
  channel: z.enum(["dine-in", "take-out", "delivery"]).optional(),
  validFrom: date,
  validTo: date.optional(),
  taxes: z.array(
    z.object({
      code: z.string().min(1),
      rate: z.string().min(1),
    }),
  ),
  fixedCop: z.number().int().optional(),
  marker: z.enum(["is_excluded", "not_taxed"]).optional(),
  rutResponsibilities: z.array(z.string().min(1)).optional(),
});

const adoptFiscalTemplateBody = z.object({
  taxpayerId: z.string().min(1),
  templateName: z.string().min(1),
});

@Controller("tenants/:tenantId")
export class TaxConfigurationController {
  constructor(
    @Inject(PublishTaxRule)
    private readonly publications: PublishTaxRule,
    @Inject(AdoptFiscalTemplate)
    private readonly adoptions: AdoptFiscalTemplate,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
  ) {}

  @Post("tax-rules")
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<Awaited<ReturnType<PublishTaxRule["execute"]>>> {
    const sessionId = readText(sessionHeader);
    const parsed = publishTaxRuleBody.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.permitOrDeny(tenantId, sessionId);

    const command: PublishTaxRuleCommand = {
      tenantId,
      ...parsed.data,
    };

    try {
      return await this.publications.execute(command);
    } catch (error: unknown) {
      if (error instanceof OverlappingTaxRule) {
        throw new ConflictException({ error: error.name });
      }

      throw error;
    }
  }

  @Post("fiscal-profiles/adopt")
  @HttpCode(HttpStatus.OK)
  async adopt(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<Awaited<ReturnType<AdoptFiscalTemplate["execute"]>>> {
    const sessionId = readText(sessionHeader);
    const parsed = adoptFiscalTemplateBody.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.permitOrDeny(tenantId, sessionId);

    const command: AdoptFiscalTemplateCommand = {
      tenantId,
      taxpayerId: parsed.data.taxpayerId,
      templateName: parsed.data.templateName,
    };

    try {
      return await this.adoptions.execute(command);
    } catch (error: unknown) {
      if (error instanceof FiscalTemplateNotFound) {
        throw new ConflictException({ error: error.name });
      }

      throw error;
    }
  }

  private async permitOrDeny(
    tenantId: string,
    sessionId: string,
  ): Promise<void> {
    const decision = await this.permit(tenantId, sessionId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "TaxConfigureDenied" });
    }
  }

  private async permit(tenantId: string, sessionId: string) {
    const evaluate = new EvaluatePermission(
      this.authorizations,
      this.sessions,
      this.identities,
      this.authorizationClock,
    );

    try {
      return await evaluate.execute({
        tenantId,
        sessionId,
        permission: ACTION,
        target: { kind: "company", id: tenantId, brandId: null },
        value: null,
        supportGrantId: null,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });
    } catch (error: unknown) {
      if (
        error instanceof UnknownSession ||
        error instanceof UnknownAuthorization
      ) {
        throw new ForbiddenException({ error: error.name });
      }

      throw error;
    }
  }
}

function readText(header: unknown): string | null {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
}
