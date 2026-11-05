import { SettleTips } from "@blackhole/cash-register/application/entry-port";
import {
  type ClosedTipSettlement,
  closedTipSettlement,
  settleTipsCommand,
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
  "POST tip-settlements": "cash.settle-tips",
} as const;

const rejectedSettlement = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "ParticipantChangeReasonRequired" ||
    error.name === "MissingTipRule" ||
    error.name === "MissingTipSettlement" ||
    error.name === "InvalidTipSettlementId" ||
    error.name === "InvalidTipWindow" ||
    error.name === "InvalidTipInstant");

@Controller("tenants/:tenantId/venues/:venueId")
export class SettleTipsController {
  constructor(
    @Inject(SettleTips)
    private readonly settlements: SettleTips,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("tip-settlements")
  @HttpCode(HttpStatus.OK)
  async settle(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ClosedTipSettlement | null> {
    const sessionId = readText(sessionHeader);
    const parsed = settleTipsCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    try {
      const saved = await this.settlements.execute({
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
        at: parsed.data.at,
        from: parsed.data.from,
        to: parsed.data.to,
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
