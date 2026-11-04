import { ApplyCourtesy } from "@blackhole/orders/application/entry-port";
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
import { z } from "zod";

import {
  authorizerOf,
  presentVoid,
  readText,
  rejectionOf,
} from "#src/http/void-command.js";

const SESSION_HEADER = "x-session-id";

const courtesyCommand = z
  .object({
    reason: z.string(),
    shiftId: z.string(),
    authorizationId: z.string().nullable(),
    value: z.number(),
  })
  .strict();

export const routePermissions = {
  "POST checks/:checkId/courtesy": "sale.comp",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ApplyCourtesyController {
  constructor(
    @Inject(ApplyCourtesy)
    private readonly courtesies: ApplyCourtesy,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("checks/:checkId/courtesy")
  @HttpCode(HttpStatus.OK)
  async applyCourtesy(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = courtesyCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    try {
      const check = await this.courtesies.execute({
        tenantId,
        venueId,
        checkId,
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
        value: parsed.data.value,
        authorizationId: parsed.data.authorizationId,
      });

      return presentVoid(check);
    } catch (error: unknown) {
      throw rejectionOf(error);
    }
  }
}
