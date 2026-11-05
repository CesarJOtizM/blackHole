import { AdjustTipSettlement } from "@blackhole/cash-register/application/entry-port";
import {
  adjustTipSettlementCommand,
  type ClosedTipSettlement,
  closedTipSettlement,
} from "@blackhole/contracts";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

import { authorizerOf, readText } from "#src/http/void-command.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST tip-settlements/:id/adjustments": "cash.settle-tips",
} as const;

const rejectedSettlement = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "ParticipantChangeReasonRequired" ||
    error.name === "MissingTipRule" ||
    error.name === "MissingTipSettlement" ||
    error.name === "InvalidTipSettlementId");

@Controller("tenants/:tenantId/venues/:venueId")
export class AdjustTipSettlementController {
  constructor(
    @Inject(AdjustTipSettlement)
    private readonly adjustments: AdjustTipSettlement,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("tip-settlements/:id/adjustments")
  @HttpCode(HttpStatus.OK)
  async adjust(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("id") adjustsSettlementId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ClosedTipSettlement | null> {
    const sessionId = readText(sessionHeader);
    const parsed = adjustTipSettlementCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    try {
      const saved = await this.adjustments.execute({
        tenantId,
        venueId,
        actorId: session.userId,
        authorizerId: await authorizerOf(
          this.authorizations,
          tenantId,
          parsed.data.authorizationId,
        ),
        sessionId,
        deviceId: session.deviceId,
        reason: parsed.data.reason,
        settlementId: parsed.data.settlementId,
        adjustsSettlementId,
        adds: parsed.data.adds,
        removes: parsed.data.removes,
      });

      if (saved === null) {
        return null;
      }

      return closedTipSettlement.parse(saved);
    } catch (error: unknown) {
      if (rejectedSettlement(error)) {
        throw new BadRequestException();
      }

      throw error;
    }
  }
}
