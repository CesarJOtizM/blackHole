import {
  ConfigureTipRule,
  InvalidTipRulePeriod,
} from "@blackhole/cash-register/application/entry-port";
import {
  type ConfiguredTipRule,
  configuredTipRule,
  configureTipRuleCommand,
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
  Put,
} from "@nestjs/common";

import { authorizerOf, readText } from "#src/http/void-command.js";

const SESSION_HEADER = "x-session-id";

export const routePermissions = {
  "PUT tip-rule": "cash.settle-tips",
} as const;

const rejectedRule = (error: unknown): boolean =>
  error instanceof InvalidTipRulePeriod ||
  (error instanceof Error &&
    (error.name === "InvalidTipPercentage" ||
      error.name === "InvalidTipRoleShare"));

@Controller("tenants/:tenantId/venues/:venueId")
export class ConfigureTipRuleController {
  constructor(
    @Inject(ConfigureTipRule)
    private readonly rules: ConfigureTipRule,
    @Inject(SessionReader)
    private readonly sessions: SessionReader,
    @Inject(AuthorizationRepository)
    private readonly authorizations: AuthorizationRepository,
  ) {}

  @Put("tip-rule")
  @HttpCode(HttpStatus.OK)
  async configure(
    @Param("tenantId") tenantId: string,
    @Param("venueId") venueId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<ConfiguredTipRule | null> {
    const sessionId = readText(sessionHeader);
    const parsed = configureTipRuleCommand.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const session = await this.sessions.find(tenantId, sessionId);

    if (!session) {
      throw new BadRequestException();
    }

    try {
      const saved = await this.rules.execute({
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
        period: parsed.data.period,
        mode: parsed.data.mode,
        shares: parsed.data.shares,
      });

      if (saved === null) {
        return null;
      }

      return configuredTipRule.parse({
        period: saved.period,
        mode: saved.mode,
        shares: saved.shares.map((share) => ({
          employeeId: share.employeeId,
          percent: share.percent,
        })),
      });
    } catch (error: unknown) {
      if (rejectedRule(error)) {
        throw new BadRequestException();
      }

      throw error;
    }
  }
}
