import {
  ApproveVariance,
  CloseShift,
  type CountReading,
  InvalidCashAmount,
  OpenShiftRequired,
  RecountRejected,
  SelfApprovalRejected,
  SubmitCount,
  UnknownRegister,
  VarianceNeedsApproval,
} from "@blackhole/cash-register/application/entry-port";
import {
  approveVarianceCommand,
  type CashCountView,
  cashCountView,
  finalCloseCommand,
  partialCloseCommand,
  submitCountCommand,
} from "@blackhole/contracts";
import {
  EvaluatePermission,
  RecordAuditEvent,
  UnknownAuthorization,
  UnknownSession,
} from "@blackhole/platform/application/entry-port";
import { AuditDigest } from "@blackhole/platform/application/ports/audit-digest";
import { AuditRepository } from "@blackhole/platform/application/ports/audit-repository";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

import { PendingSalePrinter } from "#src/composition/sale-receipt.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "GET cash-registers/:registerId/count": "cash.open-shift",
  "POST cash-registers/:registerId/count": "cash.open-shift",
  "POST cash-registers/:registerId/count/approve": "cash.approve-variance",
  "POST cash-registers/:registerId/count/partial-close": "cash.open-shift",
  "POST cash-registers/:registerId/count/final-close": "cash.open-shift",
} as const;

type CountPermission = (typeof routePermissions)[keyof typeof routePermissions];

const OPEN_SHIFT = routePermissions["POST cash-registers/:registerId/count"];
const APPROVE_VARIANCE =
  routePermissions["POST cash-registers/:registerId/count/approve"];

const DENIED: Record<CountPermission, string> = {
  "cash.open-shift": "CashOpenShiftDenied",
  "cash.approve-variance": "CashApproveVarianceDenied",
};

const DOMAIN_REJECTION = [
  InvalidCashAmount,
  OpenShiftRequired,
  RecountRejected,
  SelfApprovalRejected,
  UnknownRegister,
  VarianceNeedsApproval,
] as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class CashCountController {
  constructor(
    @Inject(SubmitCount)
    private readonly submitCount: SubmitCount,
    @Inject(ApproveVariance)
    private readonly approveVariance: ApproveVariance,
    @Inject(CloseShift)
    private readonly closeShift: CloseShift,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(IdentityReader)
    private readonly identities: IdentityReader,
    @Inject(AuthorizationClock)
    private readonly authorizationClock: AuthorizationClock,
    @Inject(AuditRepository)
    private readonly audits: AuditRepository,
    @Inject(AuditDigest)
    private readonly digests: AuditDigest,
    @Inject(Clock)
    private readonly clock: Clock,
    @Inject(PendingSalePrinter)
    private readonly receipts: PendingSalePrinter,
  ) {}

  @Get("cash-registers/:registerId/count")
  @HttpCode(HttpStatus.OK)
  async read(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
  ): Promise<CashCountView> {
    const sessionId = readText(sessionHeader);

    if (sessionId === null) {
      throw new BadRequestException();
    }

    await this.permit(tenantId, sessionId, venueId, OPEN_SHIFT, null);
    const reading = await this.capture(() =>
      this.submitCount.read({ tenantId, venueId, registerId }),
    );

    return presentCount(reading);
  }

  @Post("cash-registers/:registerId/count")
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<CashCountView> {
    const sessionId = readText(sessionHeader);
    const parsed = submitCountCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.permit(
      tenantId,
      sessionId,
      venueId,
      OPEN_SHIFT,
      null,
    );
    const recorded = presentCount(
      await this.capture(() =>
        this.submitCount.execute({
          tenantId,
          venueId,
          registerId,
          countId: parsed.data.countId,
          countedBy: actor.userId,
          denominations: parsed.data.denominations,
          terminals: parsed.data.terminals,
        }),
      ),
    );

    await this.record(
      tenantId,
      venueId,
      actor,
      OPEN_SHIFT,
      registerId,
      recorded,
    );

    return recorded;
  }

  @Post("cash-registers/:registerId/count/approve")
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<CashCountView> {
    const sessionId = readText(sessionHeader);
    const parsed = approveVarianceCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const reading = await this.capture(() =>
      this.submitCount.read({ tenantId, venueId, registerId }),
    );
    const actor = await this.permit(
      tenantId,
      sessionId,
      venueId,
      APPROVE_VARIANCE,
      Math.abs(reading.differenceCop ?? 0),
    );
    const recorded = presentCount(
      await this.capture(() =>
        this.approveVariance.execute({
          tenantId,
          venueId,
          registerId,
          approverId: actor.userId,
          justification: parsed.data.justification,
          varianceCop: parsed.data.varianceCop,
        }),
      ),
    );

    await this.record(
      tenantId,
      venueId,
      actor,
      APPROVE_VARIANCE,
      registerId,
      recorded,
    );

    return recorded;
  }

  @Post("cash-registers/:registerId/count/partial-close")
  @HttpCode(HttpStatus.OK)
  async partialClose(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<CashCountView> {
    const sessionId = readText(sessionHeader);
    const parsed = partialCloseCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.permit(
      tenantId,
      sessionId,
      venueId,
      OPEN_SHIFT,
      null,
    );
    const recorded = presentCount(
      await this.capture(() =>
        this.closeShift.partial({
          tenantId,
          venueId,
          registerId,
          countId: parsed.data.countId,
          countedBy: actor.userId,
        }),
      ),
    );

    await this.record(
      tenantId,
      venueId,
      actor,
      OPEN_SHIFT,
      registerId,
      recorded,
    );

    return recorded;
  }

  @Post("cash-registers/:registerId/count/final-close")
  @HttpCode(HttpStatus.OK)
  async finalClose(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<CashCountView> {
    const sessionId = readText(sessionHeader);
    const parsed = finalCloseCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const actor = await this.permit(
      tenantId,
      sessionId,
      venueId,
      OPEN_SHIFT,
      null,
    );
    const before = this.receipts.jobs.length;
    const recorded = presentCount(
      await this.capture(() =>
        this.closeShift.final({
          tenantId,
          venueId,
          registerId,
          varianceCop: parsed.data.varianceCop,
        }),
      ),
      this.receipts.jobs
        .slice(before)
        .some(
          (job) => job.document === "cash_close" && job.status === "waiting",
        ),
    );

    await this.record(
      tenantId,
      venueId,
      actor,
      OPEN_SHIFT,
      registerId,
      recorded,
    );

    return recorded;
  }

  private async permit(
    tenantId: string,
    sessionId: string,
    venueId: string,
    permission: CountPermission,
    value: number | null,
  ): Promise<{
    userId: string;
    deviceId: string;
    authorizerId: string | null;
  }> {
    const decision = await this.decide(
      tenantId,
      sessionId,
      venueId,
      permission,
      value,
    );

    if (decision.outcome !== "allowed") {
      throw new ForbiddenException({ error: DENIED[permission] });
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new ForbiddenException({ error: "UnknownSession" });
    }

    return {
      userId: session.userId,
      deviceId: session.deviceId,
      authorizerId: decision.selfAuthorized ? session.userId : null,
    };
  }

  private async decide(
    tenantId: string,
    sessionId: string,
    venueId: string,
    permission: CountPermission,
    value: number | null,
  ) {
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
        permission,
        target: { kind: "site", id: venueId, brandId: null },
        value,
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

  private async record(
    tenantId: string,
    venueId: string,
    actor: { userId: string; deviceId: string; authorizerId: string | null },
    action: CountPermission,
    entity: string,
    after: CashCountView,
  ): Promise<void> {
    await new RecordAuditEvent(this.audits, this.digests, this.clock).execute({
      tenantId,
      actorId: actor.userId,
      authorizerId: actor.authorizerId,
      deviceId: actor.deviceId,
      siteId: venueId,
      action,
      entity,
      before: null,
      after,
      reason: action,
    });
  }

  private async capture<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
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

function domainRejectionName(error: unknown): string | null {
  for (const Rejection of DOMAIN_REJECTION) {
    if (error instanceof Rejection) {
      return error.name;
    }
  }

  return null;
}

function presentCount(
  count: {
    state: CountReading["state"];
    countedCashCop: number | undefined;
    differenceCop: number | undefined;
  },
  printed = false,
): CashCountView {
  return cashCountView.parse({
    state: count.state,
    ...(count.countedCashCop === undefined
      ? {}
      : { countedCashCop: count.countedCashCop }),
    ...(count.differenceCop === undefined
      ? {}
      : { differenceCop: count.differenceCop }),
    ...(printed ? { printed: false } : {}),
  });
}
