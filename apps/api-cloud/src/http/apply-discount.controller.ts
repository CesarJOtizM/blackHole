import { ApplyDiscount } from "@blackhole/orders/application/entry-port";
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

const discountCommand = z
  .object({
    reason: z.string(),
    shiftId: z.string(),
    authorizationId: z.string().nullable(),
    percent: z.number(),
  })
  .strict();

export const routePermissions = {
  "POST checks/:checkId/discount": "sale.discount",
} as const;

@Controller("tenants/:tenantId/venues/:venueId")
export class ApplyDiscountController {
  constructor(
    @Inject(ApplyDiscount)
    private readonly discounts: ApplyDiscount,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Post("checks/:checkId/discount")
  @HttpCode(HttpStatus.OK)
  async applyDiscount(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Param("checkId") checkId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ) {
    const sessionId = readText(sessionHeader);
    const parsed = discountCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    try {
      const check = await this.discounts.execute({
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
        percent: parsed.data.percent,
        authorizationId: parsed.data.authorizationId,
      });

      return presentVoid(check);
    } catch (error: unknown) {
      throw rejectionOf(error);
    }
  }
}
