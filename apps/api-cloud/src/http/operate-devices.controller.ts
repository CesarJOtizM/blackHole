import {
  type DeviceResult,
  deviceRequest,
  deviceResult,
} from "@blackhole/contracts";
import {
  BadSignature,
  DeviceRevoked,
  DuplicateIdentityId,
  InvalidIdentityId,
  OperateDevices,
  RegistrationCodeExpired,
  RegistrationCodeLocked,
  RegistrationCodeRejected,
  RegistrationCodeReused,
  SiteOffline,
  StationRefused,
  UnknownIdentityReference,
  UnsignedSignature,
  UserDeactivated,
} from "@blackhole/platform/application/entry-port";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityRepository } from "@blackhole/platform/application/ports/identity-repository";
import { PasswordHasher } from "@blackhole/platform/application/ports/password-hasher";
import { SignatureVerifier } from "@blackhole/platform/application/ports/signature-verifier";
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";

const DOMAIN_REJECTION = [
  BadSignature,
  DeviceRevoked,
  DuplicateIdentityId,
  InvalidIdentityId,
  RegistrationCodeExpired,
  RegistrationCodeLocked,
  RegistrationCodeRejected,
  RegistrationCodeReused,
  SiteOffline,
  StationRefused,
  UnknownIdentityReference,
  UnsignedSignature,
  UserDeactivated,
] as const;

export const routePermissions = {
  "POST devices": "device.register",
} as const;

@Controller("tenants/:tenantId")
export class OperateDevicesController {
  constructor(
    @Inject(IdentityRepository)
    private readonly identities: IdentityRepository,
    @Inject(PasswordHasher)
    private readonly passwords: PasswordHasher,
    @Inject(SignatureVerifier)
    private readonly signatures: SignatureVerifier,
    @Inject(Clock)
    private readonly clock: Clock,
  ) {}

  @Post("devices")
  @HttpCode(HttpStatus.OK)
  async operateDevices(
    @Param("tenantId") tenantId: string,
    @Body() body: unknown,
  ): Promise<DeviceResult> {
    const parsed = deviceRequest.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException();
    }

    const operateDevices = new OperateDevices(
      this.identities,
      this.passwords,
      this.signatures,
      this.clock,
    );

    try {
      const result = await operateDevices.execute({
        tenantId,
        siteOffline: parsed.data.siteOffline,
        command: parsed.data.command,
      });
      const bodyResult =
        result.registrationCode === undefined
          ? result.event
          : { ...result.event, registrationCode: result.registrationCode };

      return deviceResult.parse(bodyResult);
    } catch (error: unknown) {
      const rejection = domainRejectionName(error);

      if (rejection !== null) {
        throw new ConflictException({ error: rejection });
      }

      throw error;
    }
  }
}

function domainRejectionName(error: unknown): string | null {
  for (const Rejection of DOMAIN_REJECTION) {
    if (error instanceof Rejection) {
      return error.name;
    }
  }

  return null;
}
