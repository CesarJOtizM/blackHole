import {
  type IdentityChanged,
  identityChanged,
  identityRequest,
} from "@blackhole/contracts";
import {
  DuplicateIdentityId,
  InvalidIdentityId,
  OperateIdentity,
  PasswordRejected,
  PinAttemptsLocked,
  PinRejected,
  SecondFactorRejected,
  SecondFactorRequired,
  SessionIdle,
  SiteOffline,
  StationRefused,
  UnknownIdentityReference,
  UserDeactivated,
} from "@blackhole/platform/application/entry-port";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityRepository } from "@blackhole/platform/application/ports/identity-repository";
import { PasswordHasher } from "@blackhole/platform/application/ports/password-hasher";
import { PinHasher } from "@blackhole/platform/application/ports/pin-hasher";
import { SecondFactor } from "@blackhole/platform/application/ports/second-factor";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

const SESSION_HEADER = "x-session-id";

const DOMAIN_REJECTION = [
  DuplicateIdentityId,
  InvalidIdentityId,
  PasswordRejected,
  PinAttemptsLocked,
  PinRejected,
  SecondFactorRejected,
  SecondFactorRequired,
  SessionIdle,
  SiteOffline,
  StationRefused,
  UnknownIdentityReference,
  UserDeactivated,
] as const;

@Controller("tenants/:tenantId")
export class OperateIdentityController {
  constructor(
    @Inject(IdentityRepository)
    private readonly identities: IdentityRepository,
    @Inject(PasswordHasher)
    private readonly passwords: PasswordHasher,
    @Inject(PinHasher)
    private readonly pins: PinHasher,
    @Inject(SecondFactor)
    private readonly secondFactor: SecondFactor,
    @Inject(Clock)
    private readonly clock: Clock,
  ) {}

  @Post("identity")
  @HttpCode(HttpStatus.OK)
  async operateIdentity(
    @Param("tenantId") tenantId: string,
    @Headers(SESSION_HEADER) sessionHeader: unknown,
    @Body() body: unknown,
  ): Promise<IdentityChanged> {
    const sessionId = readSessionId(sessionHeader);
    const parsed = identityRequest.safeParse(body);

    if (sessionId === null || !parsed.success) {
      throw new BadRequestException();
    }

    const operateIdentity = new OperateIdentity(
      this.identities,
      this.passwords,
      this.pins,
      this.secondFactor,
      this.clock,
    );

    try {
      const event = await operateIdentity.execute({
        tenantId,
        siteOffline: parsed.data.siteOffline,
        command: parsed.data.command,
      });

      return identityChanged.parse(event);
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
      }

      throw error;
    }
  }
}

function readSessionId(header: unknown): string | null {
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
