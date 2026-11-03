import { ChangeTender } from "@blackhole/cash-register/application/entry-port";
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

const tenderMethod = z.enum([
  "cash",
  "card",
  "transfer",
  "wallet",
  "voucher",
  "customer_credit",
  "corporate_credit",
]);

const changeTenderCommand = z
  .object({
    reason: z.string(),
    authorizationId: z.string().nullable(),
    reversalId: z.string(),
    replacementId: z.string(),
    method: tenderMethod,
  })
  .strict();

const changedTender = z
  .object({
    paymentId: z.string(),
    method: tenderMethod,
  })
  .strict();

export const routePermissions = {
  "POST cash-registers/:registerId/payments/:paymentId/tender":
    "sale.change-tender",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ChangeTenderController {
  constructor(
    @Inject(ChangeTender)
    private readonly tenders: ChangeTender,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("cash-registers/:registerId/payments/:paymentId/tender")
  @HttpCode(HttpStatus.OK)
  async changeTender(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("registerId") registerId: string,
    @Param("paymentId") paymentId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = changeTenderCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    await this.tenders.execute({
      tenantId,
      venueId,
      registerId,
      paymentId,
      reversalId: parsed.data.reversalId,
      replacementId: parsed.data.replacementId,
      method: parsed.data.method,
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

    return changedTender.parse({ paymentId, method: parsed.data.method });
  }
}
