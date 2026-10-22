import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import { IdentityRepository } from "@blackhole/platform/application/ports/identity-repository";
import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import { PasswordHasher } from "@blackhole/platform/application/ports/password-hasher";
import { PinHasher } from "@blackhole/platform/application/ports/pin-hasher";
import { PinVerifier } from "@blackhole/platform/application/ports/pin-verifier";
import { SecondFactor } from "@blackhole/platform/application/ports/second-factor";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import { SignatureVerifier } from "@blackhole/platform/application/ports/signature-verifier";
import { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import { type DynamicModule, Module } from "@nestjs/common";

import { AcceptCloudWriteController } from "#src/accept-cloud-write.controller.js";
import { AuthorizationController } from "#src/authorization.controller.js";
import { OperateDevicesController } from "#src/operate-devices.controller.js";
import { OperateIdentityController } from "#src/operate-identity.controller.js";
import { UpdateStructureController } from "#src/update-structure.controller.js";

export interface CloudApplicationDependencies {
  venueOperations: VenueOperationRepository;
  organizations: OrganizationRepository;
  identities: IdentityRepository;
  passwords: PasswordHasher;
  pins: PinHasher;
  secondFactor: SecondFactor;
  clock: Clock;
  signatures: SignatureVerifier;
  authorizations: AuthorizationRepository;
  sessions: SessionReader;
  identityViews: IdentityReader;
  pinConfirmations: PinVerifier;
  authorizationClock: AuthorizationClock;
}

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: Nest module registration is static
export class ApplicationModule {
  static register(dependencies: CloudApplicationDependencies): DynamicModule {
    return {
      module: ApplicationModule,
      controllers: [
        AcceptCloudWriteController,
        UpdateStructureController,
        OperateIdentityController,
        OperateDevicesController,
        AuthorizationController,
      ],
      providers: [
        {
          provide: VenueOperationRepository,
          useValue: dependencies.venueOperations,
        },
        {
          provide: OrganizationRepository,
          useValue: dependencies.organizations,
        },
        {
          provide: IdentityRepository,
          useValue: dependencies.identities,
        },
        {
          provide: PasswordHasher,
          useValue: dependencies.passwords,
        },
        {
          provide: PinHasher,
          useValue: dependencies.pins,
        },
        {
          provide: SecondFactor,
          useValue: dependencies.secondFactor,
        },
        {
          provide: Clock,
          useValue: dependencies.clock,
        },
        {
          provide: SignatureVerifier,
          useValue: dependencies.signatures,
        },
        {
          provide: AuthorizationRepository,
          useValue: dependencies.authorizations,
        },
        {
          provide: SessionReader,
          useValue: dependencies.sessions,
        },
        {
          provide: IdentityReader,
          useValue: dependencies.identityViews,
        },
        {
          provide: PinVerifier,
          useValue: dependencies.pinConfirmations,
        },
        {
          provide: AuthorizationClock,
          useValue: dependencies.authorizationClock,
        },
      ],
    };
  }
}
