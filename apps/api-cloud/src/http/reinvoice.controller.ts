import {
  approveReinvoiceCommand,
  reinvoiceApprovalResult,
  reinvoiceRequestResult,
  requestReinvoiceCommand,
} from "@blackhole/contracts";
import {
  ApproveReinvoice,
  RequestReinvoice,
} from "@blackhole/invoicing/application/entry-port";
import {
  EvaluatePermission,
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
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
  "POST reinvoices": "sale.credit-note",
  "POST reinvoices/approve": "sale.credit-note",
} as const;

const readText = (header: unknown): string | null => {
  if (typeof header !== "string" || header.length === 0) {
    return null;
  }

  return header;
};

@Controller("tenants/:tenantId/venues/:venueId")
export class ReinvoiceController {
  constructor(
    @Inject(RequestReinvoice)
    private readonly requests: RequestReinvoice,
    @Inject(ApproveReinvoice)
    private readonly approvals: ApproveReinvoice,
    @Inject(EvaluatePermission)
    private readonly permissions: EvaluatePermission,
  ) {}

  @Post("reinvoices")
  @HttpCode(HttpStatus.OK)
  async requestReinvoice(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = requestReinvoiceCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.permit(
      tenantId,
      sessionId,
      venueId,
      routePermissions["POST reinvoices"],
    );

    return reinvoiceRequestResult.parse(
      await this.requests.execute({
        companyId: tenantId,
        invoiceNumber: parsed.data.invoiceNumber,
        issuedAt: parsed.data.issuedAt,
        at: parsed.data.at,
        windowMode: parsed.data.windowMode,
      }),
    );
  }

  @Post("reinvoices/approve")
  @HttpCode(HttpStatus.OK)
  async approveReinvoice(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = approveReinvoiceCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    await this.permit(
      tenantId,
      sessionId,
      venueId,
      routePermissions["POST reinvoices/approve"],
    );

    return reinvoiceApprovalResult.parse(
      await this.approvals.execute({
        companyId: tenantId,
        invoiceNumber: parsed.data.invoiceNumber,
        at: parsed.data.at,
        windowMode: parsed.data.windowMode,
        permissions: [routePermissions["POST reinvoices/approve"]],
        original: parsed.data.original,
        creditNote: {
          ...parsed.data.creditNote,
          tenantId,
          siteId: venueId,
        },
        invoice: parsed.data.invoice,
      }),
    );
  }

  private async permit(
    tenantId: string,
    sessionId: string,
    venueId: string,
    permission: (typeof routePermissions)[keyof typeof routePermissions],
  ) {
    try {
      const decision = await this.permissions.execute({
        tenantId,
        sessionId,
        permission,
        target: { kind: "site", id: venueId, brandId: null },
        value: null,
        supportGrantId: null,
        shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      });

      if (decision.outcome !== "allowed") {
        throw new ForbiddenException({ error: "SaleCreditNoteDenied" });
      }
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
