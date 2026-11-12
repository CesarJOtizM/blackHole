import { InMemoryClockEntryRepository } from "@blackhole/attendance/adapters/memory/in-memory-clock-entry-repository";
import { SheetJsHoursWorkbook } from "@blackhole/attendance/adapters/xlsx/hours-workbook";
import { AttendancePolicyRepository } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import { ClockEntryCorrectionRepository } from "@blackhole/attendance/application/ports/clock-entry-correction-repository";
import { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import { HoursWorkbook } from "@blackhole/attendance/application/ports/hours-workbook";
import {
  AdjustTipSettlement,
  ApplyQrPayment,
  ApproveVariance,
  ChangeTender,
  ChargeCheck,
  CloseShift,
  ConfigureTipRule,
  ConfirmQrPayment,
  OpenDrawer,
  OpenShift,
  OriginalPaymentReader,
  PaidAccountReader,
  PrintTipSettlement,
  ReopenPaidAccount,
  SettleTips,
  StartQrPayment,
  SubmitCount,
  TipParticipantSource,
  TipPool,
  TipRuleStore,
  TipSettlementStore,
} from "@blackhole/cash-register/application/entry-port";
import { InMemoryRecipeCatalogRepository } from "@blackhole/inventory/adapters/memory/in-memory-recipe-catalog-repository";
import { RecipeCatalogRepository } from "@blackhole/inventory/application/ports/recipe-catalog-repository";
import { RecipeWorkbook } from "@blackhole/inventory/application/ports/recipe-workbook";
import { SitePrice } from "@blackhole/inventory/application/ports/site-price";
import { VenueDirectory as RecipeVenueDirectory } from "@blackhole/inventory/application/ports/venue-directory";
import { InMemoryFiscalProfileRepository } from "@blackhole/invoicing/adapters/memory/in-memory-fiscal-profile-repository";
import { InMemoryTaxRuleRepository } from "@blackhole/invoicing/adapters/memory/in-memory-tax-rule-repository";
import {
  AdoptFiscalTemplate,
  ApproveReinvoice,
  AttachBuyer,
  CalculateTaxes,
  CreditNoteAudit,
  CreditNoteRepository,
  DocumentBalanceStore,
  InvoicingProvider,
  IssueCreditNote,
  LookUpPortalBuyer,
  PublishTaxRule,
  RequestReinvoice,
  SetDocumentBalance,
} from "@blackhole/invoicing/application/entry-port";
import { FiscalProfileRepository } from "@blackhole/invoicing/application/ports/fiscal-profile-repository";
import { TaxRuleRepository } from "@blackhole/invoicing/application/ports/tax-rule-repository";
import { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import { InMemoryPrinter } from "@blackhole/orders/adapters/memory/in-memory-printer";
import { InMemoryQrOrderIntentRepository } from "@blackhole/orders/adapters/memory/in-memory-qr-order-intent-repository";
import { InMemoryRealtimeHub } from "@blackhole/orders/adapters/memory/in-memory-realtime-hub";
import { InMemoryStationRouteRepository } from "@blackhole/orders/adapters/memory/in-memory-station-route-repository";
import { InMemoryTableQrRepository } from "@blackhole/orders/adapters/memory/in-memory-table-qr-repository";
import {
  ApplyCourtesy,
  ApplyDiscount,
  ChangeLineState,
  ChangePrice,
  ConfigureStationRoute,
  GetCheck,
  MarkTableReady,
  OpenShiftReader,
  OpenTable,
  PlaceTable,
  PreBillLink,
  RealtimeHub,
  ReassignCheck,
  ReleaseTable,
  RequestCheck,
  TakeOrder,
  ViewStationQueue,
  ViewTableMap,
  VoidAccount,
  VoidLine,
} from "@blackhole/orders/application/entry-port";
import { Clock as OrdersClock } from "@blackhole/orders/application/ports/clock";
import { DiningRoomRepository } from "@blackhole/orders/application/ports/dining-room-repository";
import { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
import { Printer } from "@blackhole/orders/application/ports/printer";
import { QrOrderIntentRepository } from "@blackhole/orders/application/ports/qr-order-intent-repository";
import { StationDirectory } from "@blackhole/orders/application/ports/station-directory";
import { StationRouteRepository } from "@blackhole/orders/application/ports/station-route-repository";
import { TableQrRepository } from "@blackhole/orders/application/ports/table-qr-repository";
import { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";
import { Sha256AuditDigest } from "@blackhole/platform/adapters/crypto/sha256-audit-digest";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryPendingIssuance } from "@blackhole/platform/adapters/memory/in-memory-pending-issuance";
import { InMemoryProviderRateGate } from "@blackhole/platform/adapters/memory/in-memory-provider-rate-gate";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import {
  DetectUnusualBehavior,
  EvaluatePermission,
  ReadControlReport,
} from "@blackhole/platform/application/entry-port";
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
import {
  DispatchJobRepository,
  DispatchPrinterRepository,
  DispatchPrintJobs,
  EnqueuePrintJob,
  PrinterRepository,
  PrintJobRepository,
} from "@blackhole/printing/application/entry-port";
import {
  ReadCashReport,
  ReadSalesReport,
  ReadStaffReport,
  ReadTimeReport,
} from "@blackhole/reporting/application/entry-port";
import { expect, it } from "vitest";
import {
  ApplicationModule,
  MemoryCreditNoteAudit,
  MemoryCreditNotes,
  MemoryDocumentBalances,
  MemoryNumberingRanges,
  MemoryReinvoiceRequests,
  MemoryTipDispatchJobs,
  MemoryTipDispatchPrinters,
  MemoryTipPool,
  MemoryTipPrinters,
  MemoryTipPrintJobs,
  MemoryTipRules,
  MemoryTipSettlements,
} from "#src/composition/application-module.js";
import {
  InMemoryAttendancePolicyRepository,
  InMemoryClockEntryCorrectionRepository,
} from "#src/composition/attendance-memory.js";
import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { ClosedShiftReader } from "#src/composition/closed-shift-reader.js";
import { createApplication } from "#src/composition/create-application.js";
import { ExcelRecipeWorkbook } from "#src/composition/excel-recipe-workbook.js";
import { FactusSimulator } from "#src/composition/factus-simulator.js";
import {
  MissingOriginalPaymentReader,
  MissingPaidAccountReader,
} from "#src/composition/missing-sale-readers.js";
import { OrdersAccount } from "#src/composition/orders-account.js";
import { OrganizationVenueDirectory } from "#src/composition/organization-venue-directory.js";
import { ClosedQrTableAccess } from "#src/composition/qr-table-payment.js";
import {
  AbsentOpenShift,
  PermissionReportAccess,
  ReportingFacts,
} from "#src/composition/reporting-facts.js";
import { PendingSalePrinter } from "#src/composition/sale-receipt.js";
import { NumberingRangeStore } from "#src/http/invoicing.controller.js";
import {
  MemoryReprintAudit,
  ReprintCap,
} from "#src/http/printing.controller.js";
import { QrTableAccess } from "#src/http/qr-payment.controller.js";
import { StructurePrinters } from "#src/http/update-structure.controller.js";

it("given api-cloud, when it is created and closed, then no port is listening", async () => {
  const application = await createApplication(cloudDependencies());

  let listening = true;

  try {
    listening = application.getHttpAdapter().getInstance().server.listening;
  } finally {
    await application.close();
  }

  expect(listening).toBe(false);
});

it("given the created application, when its routes are listed, then health is available", async () => {
  const application = await createApplication(cloudDependencies());

  try {
    const routes = application.getHttpAdapter().getInstance().printRoutes();

    expect(routes).toMatch(/health/i);
  } finally {
    await application.close();
  }
});

it("given startup, when it is inspected, then there is no persistence dialect", async () => {
  const dependencies = cloudDependencies();
  const application = await createApplication(dependencies);

  try {
    const registered = ApplicationModule.register(dependencies);
    const repository = application.get(VenueOperationRepository);
    const organizationRepository = application.get(OrganizationRepository);
    const identityRepository = application.get(IdentityRepository);

    const guardedInject = [
      DiningRoomRepository,
      OpenShiftReader,
      AuditRepository,
      AuditDigest,
      Clock,
      AuthorizationRepository,
      SessionReader,
      IdentityReader,
      AuthorizationClock,
    ];

    expect(registered.providers).toEqual([
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
        useValue: new InMemoryAuditRepository(),
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
        useValue: dependencies.providerRate,
      },
      {
        provide: PendingIssuance,
        useValue: dependencies.pendingIssuance,
      },
      {
        provide: FactusSimulator,
        useValue: dependencies.factus,
      },
      {
        provide: MenuRepository,
        useValue: new InMemoryMenuRepository(),
      },
      {
        provide: TableQrRepository,
        useValue: new InMemoryTableQrRepository(),
      },
      {
        provide: QrOrderIntentRepository,
        useValue: new InMemoryQrOrderIntentRepository(),
      },
      {
        provide: DiningRoomRepository,
        useValue: new InMemoryDiningRoomRepository(),
      },
      {
        provide: OpenShiftReader,
        useValue: new ClosedShiftReader(),
      },
      {
        provide: PaidAccountReader,
        useValue: new MissingPaidAccountReader(),
      },
      {
        provide: OriginalPaymentReader,
        useValue: new MissingOriginalPaymentReader(),
      },
      {
        provide: StationRouteRepository,
        useValue: new InMemoryStationRouteRepository(),
      },
      {
        provide: PlaceTable,
        useFactory: expect.any(Function),
        inject: [DiningRoomRepository],
      },
      {
        provide: ConfigureStationRoute,
        useFactory: expect.any(Function),
        inject: [StationRouteRepository],
      },
      {
        provide: OrdersClock,
        useFactory: expect.any(Function),
        inject: [Clock],
      },
      {
        provide: OpenTable,
        useFactory: expect.any(Function),
        inject: [DiningRoomRepository, OrdersClock],
      },
      {
        provide: OpenShift,
        useFactory: expect.any(Function),
        inject: [OrganizationRepository],
      },
      {
        provide: OrdersAccount,
        useFactory: expect.any(Function),
        inject: [
          DiningRoomRepository,
          MenuRepository,
          VenueDirectory,
          OrdersClock,
        ],
      },
      {
        provide: PendingSalePrinter,
        useValue: new PendingSalePrinter(),
      },
      {
        provide: ChargeCheck,
        useFactory: expect.any(Function),
        inject: [
          OrganizationRepository,
          OrdersAccount,
          AuditRepository,
          AuditDigest,
          Clock,
        ],
      },
      {
        provide: SubmitCount,
        useFactory: expect.any(Function),
        inject: [OrganizationRepository],
      },
      {
        provide: ApproveVariance,
        useFactory: expect.any(Function),
        inject: [OrganizationRepository],
      },
      {
        provide: CloseShift,
        useFactory: expect.any(Function),
        inject: [OrganizationRepository],
      },
      {
        provide: ReleaseTable,
        useFactory: expect.any(Function),
        inject: [DiningRoomRepository],
      },
      {
        provide: MarkTableReady,
        useFactory: expect.any(Function),
        inject: [DiningRoomRepository],
      },
      {
        provide: PreBillLink,
        useFactory: expect.any(Function),
        inject: [Secrets],
      },
      {
        provide: RequestCheck,
        useFactory: expect.any(Function),
        inject: [
          DiningRoomRepository,
          OrdersClock,
          Printer,
          RealtimeHub,
          PreBillLink,
        ],
      },
      {
        provide: ReassignCheck,
        useFactory: expect.any(Function),
        inject: guardedInject,
      },
      {
        provide: Printer,
        useValue: new InMemoryPrinter(),
      },
      {
        provide: RealtimeHub,
        useValue: new InMemoryRealtimeHub(),
      },
      {
        provide: StationDirectory,
        useFactory: expect.any(Function),
        inject: [StationRouteRepository],
      },
      {
        provide: TakeOrder,
        useFactory: expect.any(Function),
        inject: [
          DiningRoomRepository,
          MenuRepository,
          StationDirectory,
          Printer,
          OrdersClock,
          RealtimeHub,
          OpenShiftReader,
          AuditRepository,
          AuditDigest,
          Clock,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
        ],
      },
      {
        provide: VoidLine,
        useFactory: expect.any(Function),
        inject: guardedInject,
      },
      {
        provide: VoidAccount,
        useFactory: expect.any(Function),
        inject: guardedInject,
      },
      {
        provide: ApplyDiscount,
        useFactory: expect.any(Function),
        inject: guardedInject,
      },
      {
        provide: ApplyCourtesy,
        useFactory: expect.any(Function),
        inject: guardedInject,
      },
      {
        provide: ChangePrice,
        useFactory: expect.any(Function),
        inject: guardedInject,
      },
      {
        provide: OpenDrawer,
        useFactory: expect.any(Function),
        inject: [
          OrganizationRepository,
          AuditRepository,
          AuditDigest,
          Clock,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
        ],
      },
      { provide: TipRuleStore, useValue: new MemoryTipRules() },
      {
        provide: ConfigureTipRule,
        useFactory: expect.any(Function),
        inject: [
          TipRuleStore,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
          AuditRepository,
          AuditDigest,
          Clock,
        ],
      },
      { provide: TipPool, useValue: new MemoryTipPool() },
      {
        provide: TipParticipantSource,
        useFactory: expect.any(Function),
        inject: [
          ClockEntryRepository,
          ClockEntryCorrectionRepository,
          AttendancePolicyRepository,
        ],
      },
      { provide: TipSettlementStore, useValue: new MemoryTipSettlements() },
      {
        provide: SettleTips,
        useFactory: expect.any(Function),
        inject: [
          TipRuleStore,
          TipPool,
          TipParticipantSource,
          TipSettlementStore,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
          AuditRepository,
          AuditDigest,
          Clock,
        ],
      },
      {
        provide: AdjustTipSettlement,
        useFactory: expect.any(Function),
        inject: [
          TipRuleStore,
          TipSettlementStore,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
          AuditRepository,
          AuditDigest,
          Clock,
        ],
      },
      { provide: PrintJobRepository, useValue: new MemoryTipPrintJobs() },
      { provide: PrinterRepository, useValue: new MemoryTipPrinters() },
      {
        provide: DispatchJobRepository,
        useValue: new MemoryTipDispatchJobs(new MemoryTipPrintJobs()),
      },
      {
        provide: DispatchPrinterRepository,
        useValue: new MemoryTipDispatchPrinters(new MemoryTipPrinters()),
      },
      {
        provide: EnqueuePrintJob,
        useFactory: expect.any(Function),
        inject: [PrinterRepository, PrintJobRepository],
      },
      {
        provide: DispatchPrintJobs,
        useFactory: expect.any(Function),
        inject: [DispatchJobRepository, DispatchPrinterRepository],
      },
      {
        provide: PrintTipSettlement,
        useFactory: expect.any(Function),
        inject: [
          TipSettlementStore,
          EnqueuePrintJob,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
        ],
      },
      {
        provide: ReopenPaidAccount,
        useFactory: expect.any(Function),
        inject: [
          PaidAccountReader,
          AuditRepository,
          AuditDigest,
          Clock,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
        ],
      },
      {
        provide: ChangeTender,
        useFactory: expect.any(Function),
        inject: [
          OriginalPaymentReader,
          AuditRepository,
          AuditDigest,
          Clock,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
        ],
      },
      {
        provide: ChangeLineState,
        useFactory: expect.any(Function),
        inject: [DiningRoomRepository, OrdersClock, RealtimeHub],
      },
      {
        provide: ViewTableMap,
        useFactory: expect.any(Function),
        inject: [DiningRoomRepository],
      },
      {
        provide: ViewStationQueue,
        useFactory: expect.any(Function),
        inject: [DiningRoomRepository, StationRouteRepository, OrdersClock],
      },
      {
        provide: GetCheck,
        useFactory: expect.any(Function),
        inject: [DiningRoomRepository],
      },
      {
        provide: VenueDirectory,
        useValue: new OrganizationVenueDirectory(dependencies.organizations),
      },
      {
        provide: AuditDigest,
        useValue: new Sha256AuditDigest(),
      },
      {
        provide: ClockEntryRepository,
        useValue: new InMemoryClockEntryRepository(),
      },
      {
        provide: ClockEntryCorrectionRepository,
        useValue: new InMemoryClockEntryCorrectionRepository(),
      },
      {
        provide: AttendancePolicyRepository,
        useValue: new InMemoryAttendancePolicyRepository(),
      },
      {
        provide: HoursWorkbook,
        useValue: new SheetJsHoursWorkbook(),
      },
      {
        provide: TaxRuleRepository,
        useValue: new InMemoryTaxRuleRepository(),
      },
      {
        provide: FiscalProfileRepository,
        useValue: new InMemoryFiscalProfileRepository(),
      },
      {
        provide: CalculateTaxes,
        useFactory: expect.any(Function),
        inject: [FiscalProfileRepository, TaxRuleRepository],
      },
      {
        provide: PublishTaxRule,
        useFactory: expect.any(Function),
        inject: [TaxRuleRepository],
      },
      {
        provide: AdoptFiscalTemplate,
        useFactory: expect.any(Function),
        inject: [FiscalProfileRepository],
      },
      {
        provide: InvoicingProvider,
        useValue: expect.any(InvoicingProvider),
      },
      {
        provide: "OneTimeCodeSender",
        useValue: expect.any(Object),
      },
      {
        provide: LookUpPortalBuyer,
        useFactory: expect.any(Function),
        inject: [InvoicingProvider],
      },
      {
        provide: MemoryReinvoiceRequests,
        useValue: new MemoryReinvoiceRequests(),
      },
      {
        provide: RequestReinvoice,
        useFactory: expect.any(Function),
        inject: [InvoicingProvider],
      },
      {
        provide: AttachBuyer,
        useFactory: expect.any(Function),
        inject: [InvoicingProvider],
      },
      {
        provide: DocumentBalanceStore,
        useValue: new MemoryDocumentBalances(),
      },
      {
        provide: SetDocumentBalance,
        useFactory: expect.any(Function),
        inject: [DocumentBalanceStore],
      },
      {
        provide: CreditNoteRepository,
        useValue: new MemoryCreditNotes(),
      },
      {
        provide: CreditNoteAudit,
        useValue: new MemoryCreditNoteAudit(new MemoryCreditNotes()),
      },
      {
        provide: IssueCreditNote,
        useFactory: expect.any(Function),
        inject: [InvoicingProvider, CreditNoteRepository, CreditNoteAudit],
      },
      {
        provide: ApproveReinvoice,
        useFactory: expect.any(Function),
        inject: [IssueCreditNote],
      },
      {
        provide: NumberingRangeStore,
        useValue: new MemoryNumberingRanges(),
      },
      {
        provide: ReprintCap,
        useValue: new ReprintCap(null),
      },
      {
        provide: MemoryReprintAudit,
        useValue: new MemoryReprintAudit(),
      },
      {
        provide: StructurePrinters,
        useValue: new StructurePrinters(),
      },
      {
        provide: EvaluatePermission,
        useFactory: expect.any(Function),
        inject: [
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
        ],
      },
      {
        provide: ReadControlReport,
        useFactory: expect.any(Function),
        inject: [AuditRepository, EvaluatePermission],
      },
      {
        provide: ReportingFacts,
        useFactory: expect.any(Function),
        inject: [
          DiningRoomRepository,
          ClockEntryRepository,
          ClockEntryCorrectionRepository,
          AttendancePolicyRepository,
        ],
      },
      {
        provide: PermissionReportAccess,
        useFactory: expect.any(Function),
        inject: [AuthorizationRepository, AuthorizationClock],
      },
      {
        provide: AbsentOpenShift,
        useFactory: expect.any(Function),
      },
      {
        provide: ReadSalesReport,
        useFactory: expect.any(Function),
        inject: [PermissionReportAccess, AbsentOpenShift, ReportingFacts],
      },
      {
        provide: ReadTimeReport,
        useFactory: expect.any(Function),
        inject: [PermissionReportAccess, AbsentOpenShift, ReportingFacts],
      },
      {
        provide: ReadCashReport,
        useFactory: expect.any(Function),
        inject: [PermissionReportAccess, AbsentOpenShift, ReportingFacts],
      },
      {
        provide: ReadStaffReport,
        useFactory: expect.any(Function),
        inject: [PermissionReportAccess, AbsentOpenShift, ReportingFacts],
      },
      {
        provide: DetectUnusualBehavior,
        useFactory: expect.any(Function),
        inject: [AuditRepository],
      },
      {
        provide: RecipeCatalogRepository,
        useValue: new InMemoryRecipeCatalogRepository(),
      },
      {
        provide: RecipeWorkbook,
        useValue: new ExcelRecipeWorkbook(),
      },
      {
        provide: SitePrice,
        useFactory: expect.any(Function),
        inject: [MenuRepository, VenueDirectory, OrdersClock],
      },
      {
        provide: RecipeVenueDirectory,
        useFactory: expect.any(Function),
        inject: [VenueDirectory],
      },
      {
        provide: QrTableAccess,
        useClass: ClosedQrTableAccess,
      },
      {
        provide: StartQrPayment,
        useFactory: expect.any(Function),
        inject: [OrdersAccount, Clock],
      },
      {
        provide: ConfirmQrPayment,
        useFactory: expect.any(Function),
      },
      {
        provide: ApplyQrPayment,
        useFactory: expect.any(Function),
        inject: [OrdersAccount],
      },
    ]);
    expect(repository).toBe(dependencies.venueOperations);
    expect(repository).toBeInstanceOf(InMemoryVenueOperationRepository);
    expect(organizationRepository).toBe(dependencies.organizations);
    expect(organizationRepository).toBeInstanceOf(
      InMemoryOrganizationRepository,
    );
    expect(identityRepository).toBe(dependencies.identities);
    expect(identityRepository).toBeInstanceOf(InMemoryIdentityRepository);
  } finally {
    await application.close();
  }
});

function cloudDependencies() {
  const identities = new InMemoryIdentityRepository();
  const clock = new FakeClock(0);

  return {
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: new InMemoryOrganizationRepository(),
    identities,
    passwords: new FastPasswordHasher(),
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock,
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(identities, clock),
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
    providerRate: new InMemoryProviderRateGate(),
    pendingIssuance: new InMemoryPendingIssuance(clock),
    factus: new FactusSimulator(),
  };
}
