import { InMemoryPendingIssuance } from "@blackhole/platform/adapters/memory/in-memory-pending-issuance";
import { InMemoryProviderRateGate } from "@blackhole/platform/adapters/memory/in-memory-provider-rate-gate";
import { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import { Clock } from "@blackhole/platform/application/ports/clock";
import { FileStorage } from "@blackhole/platform/application/ports/file-storage";
import { IdentityReader } from "@blackhole/platform/application/ports/identity-reader";
import { IdentityRepository } from "@blackhole/platform/application/ports/identity-repository";
import { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";
import { PasswordHasher } from "@blackhole/platform/application/ports/password-hasher";
import { PendingIssuance } from "@blackhole/platform/application/ports/pending-issuance";
import { PinHasher } from "@blackhole/platform/application/ports/pin-hasher";
import { PinVerifier } from "@blackhole/platform/application/ports/pin-verifier";
import { ProviderRateGate } from "@blackhole/platform/application/ports/provider-rate-gate";
import { RuntimeMetrics } from "@blackhole/platform/application/ports/runtime-metrics";
import { SecondFactor } from "@blackhole/platform/application/ports/second-factor";
import { Secrets } from "@blackhole/platform/application/ports/secrets";
import { SessionReader } from "@blackhole/platform/application/ports/session-reader";
import { SignatureVerifier } from "@blackhole/platform/application/ports/signature-verifier";
import { VenueOperationRepository } from "@blackhole/platform/application/ports/venue-operation-repository";
import { type DynamicModule, Module } from "@nestjs/common";

import { AcceptCloudWriteController } from "#src/accept-cloud-write.controller.js";
import { AuthorizationController } from "#src/authorization.controller.js";
import { FactusSimulator } from "#src/factus-simulator.js";
import { HealthController } from "#src/health.controller.js";
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
  fileStorage: FileStorage;
  secrets: Secrets;
  metrics: RuntimeMetrics;
  providerRate?: ProviderRateGate;
  pendingIssuance?: PendingIssuance;
  factus?: FactusSimulator;
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
        HealthController,
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
        {
          provide: FileStorage,
          useValue: dependencies.fileStorage,
        },
        {
          provide: Secrets,
          useValue: dependencies.secrets,
        },
        {
          provide: RuntimeMetrics,
          useValue: dependencies.metrics,
        },
        {
          provide: ProviderRateGate,
          useValue: dependencies.providerRate ?? new InMemoryProviderRateGate(),
        },
        {
          provide: PendingIssuance,
          useValue:
            dependencies.pendingIssuance ??
            new InMemoryPendingIssuance(dependencies.clock),
        },
        {
          provide: FactusSimulator,
          useValue: dependencies.factus ?? new FactusSimulator(),
        },
      ],
    };
  }
}
