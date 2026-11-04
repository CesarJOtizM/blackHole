import { ReopenPaidAccount } from "@blackhole/cash-register/application/entry-port";
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

const reopenCommand = z
  .object({
    reason: z.string(),
    authorizationId: z.string().nullable(),
    reversalId: z.string(),
  })
  .strict();

const reopenedAccount = z
  .object({
    paymentId: z.string(),
  })
  .strict();

export const routePermissions = {
  "POST cash-registers/:registerId/payments/:paymentId/reopen":
    "sale.reopen-paid",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ReopenPaidAccountController {
  constructor(
    @Inject(ReopenPaidAccount)
    private readonly accounts: ReopenPaidAccount,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("cash-registers/:registerId/payments/:paymentId/reopen")
  @HttpCode(HttpStatus.OK)
  async reopen(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Param("paymentId") paymentId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = reopenCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    await this.accounts.execute({
      tenantId,
      venueId,
      registerId,
      paymentId,
      reversalId: parsed.data.reversalId,
      actorId: session.userId,
      authorizerId: await authorizerOf(
        this.authorizations,
        tenantId,
        parsed.data.authorizationId,
      ),
      sessionId,
      deviceId: session.deviceId,
      reason: parsed.data.reason,
      authorizationId: parsed.data.authorizationId,
    });

    return reopenedAccount.parse({ paymentId });
  }
}
