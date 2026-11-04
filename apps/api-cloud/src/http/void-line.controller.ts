import { VoidLine } from "@blackhole/orders/application/entry-port";
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

import {
  authorizerOf,
  presentVoid,
  readText,
  rejectionOf,
  voidCommand,
} from "#src/http/void-command.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "POST checks/:checkId/lines/:lineId/void": "sale.void-before-kitchen",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class VoidLineController {
  constructor(
    @Inject(VoidLine)
    private readonly lines: VoidLine,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("checks/:checkId/lines/:lineId/void")
  @HttpCode(HttpStatus.OK)
  async voidLine(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Param("lineId") lineId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = voidCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    try {
      const check = await this.lines.execute({
        tenantId,
        venueId,
        checkId,
        lineId,
        actorId: session.userId,
        authorizerId: await authorizerOf(
          this.authorizations,
          tenantId,
          parsed.data.authorizationId,
        ),
        sessionId,
        deviceId: session.deviceId,
        shiftId: parsed.data.shiftId,
        reason: parsed.data.reason,
        authorizationId: parsed.data.authorizationId,
      });

      return presentVoid(check);
    } catch (error: unknown) {
      throw rejectionOf(error);
    }
  }
}
