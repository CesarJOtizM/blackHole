import {
  CalculateTaxes,
  type CalculateTaxesCommand,
  NoMatchingTaxRule,
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
  "POST tax-quotes": "tax.configure",
} as const;

const ACTION = routePermissions["POST tax-quotes"];

const taxQuoteBody = z.object({
  profileId: z.string().min(1),
  lines: z
    .array(
      z.object({
        priceCop: z.number().int(),
        taxClassification: z.string().min(1),
      }),
    )
    .min(1),
  soldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel: z.enum(["dine-in", "take-out", "delivery"]),
  voluntaryTipCop: z.number().int(),
  bagCount: z.number().int(),
  deliveryBagsEnabled: z.boolean(),
  paidCop: z.number().int(),
});

@Controller("tenants/:tenantId")
export class TaxQuoteController {
  constructor(
    @Inject(CalculateTaxes)
    private readonly quotes: CalculateTaxes,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
  ) {}

  @Post("tax-quotes")
  @HttpCode(HttpStatus.OK)
  async quote(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<Awaited<ReturnType<CalculateTaxes["execute"]>>> {
    const sessionId = readText(sessionHeader);
    const parsed = taxQuoteBody.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(tenantId, sessionId);

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: "TaxConfigureDenied" });
    }

    const command: CalculateTaxesCommand = {
      tenantId,
      ...parsed.data,
    };

    try {
      return await this.quotes.execute(command);
    } catch (error: unknown) {
      if (error instanceof NoMatchingTaxRule) {
        throw new ConflictException({ error: error.name });
      }

      throw error;
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
