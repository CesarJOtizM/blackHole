import {
  acquirerLookupResult,
  assignNumberingRangeCommand,
  attachBuyerCommand,
  attachedBuyer,
  documentBalanceResult,
  issueCreditNoteCommand,
  issuedCreditNote,
  lookupAcquirerCommand,
  type NumberingRangeAssignment,
  numberingRangeAssignment,
  setDocumentBalanceCommand,
} from "@blackhole/contracts";
import {
  AttachBuyer,
  InvalidNitCheckDigit,
  InvoicingProvider,
  IssueCreditNote,
  type SalesDocument,
  SetDocumentBalance,
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
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST acquirers/lookup": "sale.charge",
  "POST closures/:closureId/buyer": "sale.charge",
  "POST document-balance": "tax.configure",
  "POST numbering-ranges": "tax.configure",
  "POST credit-notes": "sale.credit-note",
} as const;

type InvoicingPermission =
  (typeof routePermissions)[keyof typeof routePermissions];

const DENIED = {
  "sale.charge": "SaleChargeDenied",
  "tax.configure": "TaxConfigureDenied",
  "sale.credit-note": "SaleCreditNoteDenied",
} as const;

const GENERIC_BUYER = {
  documentType: "13",
  documentNumber: "222222222222",
  name: "Consumidor final",
  responsibility: "R-99-PN",
} as const;

export abstract class NumberingRangeStore {
  abstract save(
    range: NumberingRangeAssignment,
  ): Promise<NumberingRangeAssignment>;
}

@Controller("tenants/:tenantId/venues/:venueId")
export class InvoicingController {
  constructor(
    @Inject(InvoicingProvider)
    private readonly provider: InvoicingProvider,
    @Inject(AttachBuyer)
    private readonly buyers: AttachBuyer,
    @Inject(SetDocumentBalance)
    private readonly balances: SetDocumentBalance,
    @Inject(IssueCreditNote)
    private readonly creditNotes: IssueCreditNote,
    @Inject(NumberingRangeStore)
    private readonly ranges: NumberingRangeStore,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
  ) {}

  @Post("acquirers/lookup")
  @HttpCode(HttpStatus.OK)
  async lookupAcquirer(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = lookupAcquirerCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.permit(
      tenantId,
      sessionId,
      venueId,
      routePermissions["POST acquirers/lookup"],
    );

    const lookup = await this.provider.lookupAcquirer(parsed.data);

    return acquirerLookupResult.parse(lookup);
  }

  @Post("closures/:closureId/buyer")
  @HttpCode(HttpStatus.OK)
  async attachBuyer(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("closureId") closureId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = attachBuyerCommand.safeParse(body);

    if (sessionId === null || !parsed.success || closureId.length === 0) {
      throw new BadRequestException();
    }

    await this.permit(
      tenantId,
      sessionId,
      venueId,
      routePermissions["POST closures/:closureId/buyer"],
    );

    try {
      const attached = await this.buyers.execute({
        taxpayerEmail: parsed.data.taxpayerEmail,
        documentType: parsed.data.documentType,
        documentNumber: parsed.data.documentNumber,
      });

      return attachedBuyer.parse(attached);
    } catch (error: unknown) {
      if (error instanceof InvalidNitCheckDigit) {
        throw new BadRequestException({ error: error.name });
      }

      throw error;
    }
  }

  @Post("document-balance")
  @HttpCode(HttpStatus.OK)
  async setDocumentBalance(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = setDocumentBalanceCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.permit(
      tenantId,
      sessionId,
      venueId,
      routePermissions["POST document-balance"],
    );

    const balance = await this.balances.execute({
      companyId: tenantId,
      nit: parsed.data.nit,
      siteId: venueId,
      remaining: parsed.data.remaining,
    });

    return documentBalanceResult.parse(balance);
  }

  @Post("numbering-ranges")
  @HttpCode(HttpStatus.OK)
  async assignNumberingRange(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = assignNumberingRangeCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.permit(
      tenantId,
      sessionId,
      venueId,
      routePermissions["POST numbering-ranges"],
    );

    const assignment = numberingRangeAssignment.parse({
      tenantId,
      venueId,
      numberingRangeId: parsed.data.numberingRangeId,
      registerId: parsed.data.registerId ?? null,
    });

    return this.ranges.save(assignment);
  }

  @Post("credit-notes")
  @HttpCode(HttpStatus.OK)
  async issueCreditNote(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = issueCreditNoteCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const decision = await this.permit(
      tenantId,
      sessionId,
      venueId,
      routePermissions["POST credit-notes"],
    );
    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    const original: SalesDocument = {
      closureId: parsed.data.closureId,
      referenceCode: parsed.data.originalReferenceCode,
      status: "accepted",
      buyer: {
        documentType: GENERIC_BUYER.documentType,
        documentNumber: GENERIC_BUYER.documentNumber,
        name: GENERIC_BUYER.name,
        responsibility: GENERIC_BUYER.responsibility,
        email: parsed.data.taxpayerEmail,
      },
    };
    const issued = await this.creditNotes.execute({
      permissions: [routePermissions["POST credit-notes"]],
      original,
      referenceCode: parsed.data.referenceCode,
      tenantId,
      actorId: session.userId,
      authorizerId: decision.selfAuthorized ? session.userId : null,
      deviceId: session.deviceId,
      siteId: venueId,
      reason: parsed.data.reason,
    });

    if (issued.outcome !== "issued") {
      throw new ForbiddenException({ error: DENIED["sale.credit-note"] });
    }

    return issuedCreditNote.parse(issued);
  }

  private async permit(
    tenantId: string,
    sessionId: string,
    venueId: string,
    permission: InvoicingPermission,
  ) {
    const evaluate = new EvaluatePermission(
      this.authorizations,
      this.sessions,
      this.identities,
      this.authorizationClock,
    );

    try {
      const decision = await evaluate.execute({
        tenantId,
        sessionId,
        permission,
        target: { kind: "site", id: venueId, brandId: null },
        value: null,
        supportGrantId: null,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });

      if (decision.outcome !== "allowed") {
        throw new ForbiddenException({ error: DENIED[permission] });
      }

      return decision;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

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

const readText = (header: unknown): string | null => {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
};
