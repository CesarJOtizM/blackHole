import { InMemoryClockEntryRepository } from "@blackhole/attendance/adapters/memory/in-memory-clock-entry-repository";
import { SheetJsHoursWorkbook } from "@blackhole/attendance/adapters/xlsx/hours-workbook";
import { AttendancePolicyRepository } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import { ClockEntryCorrectionRepository } from "@blackhole/attendance/application/ports/clock-entry-correction-repository";
import { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import { HoursWorkbook } from "@blackhole/attendance/application/ports/hours-workbook";
import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
import { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";
import { Sha256AuditDigest } from "@blackhole/platform/adapters/crypto/sha256-audit-digest";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
import { InMemoryPendingIssuance } from "@blackhole/platform/adapters/memory/in-memory-pending-issuance";
import { InMemoryProviderRateGate } from "@blackhole/platform/adapters/memory/in-memory-provider-rate-gate";
import { AuditDigest } from "@blackhole/platform/application/ports/audit-digest";
import { AuditRepository } from "@blackhole/platform/application/ports/audit-repository";
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
import {
  InMemoryAttendancePolicyRepository,
  InMemoryClockEntryCorrectionRepository,
} from "#src/composition/attendance-memory.js";
import { FactusSimulator } from "#src/composition/factus-simulator.js";
import { OrganizationVenueDirectory } from "#src/composition/organization-venue-directory.js";
import { AcceptCloudWriteController } from "#src/http/accept-cloud-write.controller.js";
import { AttendanceController } from "#src/http/attendance.controller.js";
import { AuthorizationController } from "#src/http/authorization.controller.js";
import { HealthController } from "#src/http/health.controller.js";
import { OperateDevicesController } from "#src/http/operate-devices.controller.js";
import { OperateIdentityController } from "#src/http/operate-identity.controller.js";
import { ReadAuditController } from "#src/http/read-audit.controller.js";
import { UpdateMenuController } from "#src/http/update-menu.controller.js";
import { UpdateStructureController } from "#src/http/update-structure.controller.js";
import { ViewVenueMenuController } from "#src/http/view-venue-menu.controller.js";

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
  audits?: AuditRepository;
  menus?: MenuRepository;
  digests?: AuditDigest;
  clockEntries?: ClockEntryRepository;
  corrections?: ClockEntryCorrectionRepository;
  policies?: AttendancePolicyRepository;
  workbook?: HoursWorkbook;
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
        ReadAuditController,
        UpdateMenuController,
        ViewVenueMenuController,
        AttendanceController,
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
          provide: AuditRepository,
          useValue: dependencies.audits ?? new InMemoryAuditRepository(),
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
        {
          provide: MenuRepository,
          useValue: dependencies.menus ?? new InMemoryMenuRepository(),
        },
        {
          provide: VenueDirectory,
          useValue: new OrganizationVenueDirectory(dependencies.organizations),
        },
        {
          provide: AuditDigest,
          useValue: dependencies.digests ?? new Sha256AuditDigest(),
        },
        {
          provide: ClockEntryRepository,
          useValue:
            dependencies.clockEntries ?? new InMemoryClockEntryRepository(),
        },
        {
          provide: ClockEntryCorrectionRepository,
          useValue:
            dependencies.corrections ??
            new InMemoryClockEntryCorrectionRepository(),
        },
        {
          provide: AttendancePolicyRepository,
          useValue:
            dependencies.policies ?? new InMemoryAttendancePolicyRepository(),
        },
        {
          provide: HoursWorkbook,
          useValue: dependencies.workbook ?? new SheetJsHoursWorkbook(),
        },
      ],
    };
  }
}
