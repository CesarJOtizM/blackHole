import { OpenDrawer } from "@blackhole/cash-register/application/entry-port";
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

import { authorizerOf, readText } from "#src/http/void-command.js";

const SESSION_HEADER = "x-session-id";

const openDrawerCommand = z
  .object({
    reason: z.string(),
    shiftId: z.string(),
    authorizationId: z.string().nullable(),
    commandId: z.string(),
  })
  .strict();

const openedDrawer = z
  .object({
    registerId: z.string(),
  })
  .strict();

export const routePermissions = {
  "POST cash-registers/:registerId/open-drawer": "cash.open-drawer",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class OpenDrawerController {
  constructor(
    @Inject(OpenDrawer)
    private readonly drawers: OpenDrawer,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("cash-registers/:registerId/open-drawer")
  @HttpCode(HttpStatus.OK)
  async openDrawer(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = openDrawerCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    await this.drawers.execute({
      tenantId,
      venueId,
      registerId,
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
      commandId: parsed.data.commandId,
      authorizationId: parsed.data.authorizationId,
    });

    return openedDrawer.parse({ registerId });
  }
}
