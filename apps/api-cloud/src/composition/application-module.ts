import { InMemoryClockEntryRepository } from "@blackhole/attendance/adapters/memory/in-memory-clock-entry-repository";
import { SheetJsHoursWorkbook } from "@blackhole/attendance/adapters/xlsx/hours-workbook";
import { AttendancePolicyRepository } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import { ClockEntryCorrectionRepository } from "@blackhole/attendance/application/ports/clock-entry-correction-repository";
import { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import { HoursWorkbook } from "@blackhole/attendance/application/ports/hours-workbook";
import { ManualCardTerminal } from "@blackhole/cash-register/adapters/manual-terminal/manual-card-terminal";
import { InMemoryCashRegisterRepository } from "@blackhole/cash-register/adapters/memory/in-memory-cash-register-repository";
import {
  ApproveVariance,
  ChargeCheck,
  CloseShift,
  OpenShift,
  type Payment,
  SubmitCount,
} from "@blackhole/cash-register/application/entry-port";
import type { NumberingRangeAssignment } from "@blackhole/contracts";
import { InMemoryFiscalProfileRepository } from "@blackhole/invoicing/adapters/memory/in-memory-fiscal-profile-repository";
import { InMemoryTaxRuleRepository } from "@blackhole/invoicing/adapters/memory/in-memory-tax-rule-repository";
import {
  AdoptFiscalTemplate,
  AttachBuyer,
  CalculateTaxes,
  type CreditNote,
  CreditNoteAudit,
  type CreditNoteAuditCommand,
  CreditNoteRepository,
  type DocumentBalanceKey,
  DocumentBalanceStore,
  InvoicingProvider,
  IssueCreditNote,
  type OpeningDocumentBalance,
  PublishTaxRule,
  SetDocumentBalance,
} from "@blackhole/invoicing/application/entry-port";
import { FiscalProfileRepository } from "@blackhole/invoicing/application/ports/fiscal-profile-repository";
import { TaxRuleRepository } from "@blackhole/invoicing/application/ports/tax-rule-repository";
import { InMemoryDiningRoomRepository } from "@blackhole/orders/adapters/memory/in-memory-dining-room-repository";
import { InMemoryMenuRepository } from "@blackhole/orders/adapters/memory/in-memory-menu-repository";
import { InMemoryPrinter } from "@blackhole/orders/adapters/memory/in-memory-printer";
import { InMemoryRealtimeHub } from "@blackhole/orders/adapters/memory/in-memory-realtime-hub";
import { InMemoryStationRouteRepository } from "@blackhole/orders/adapters/memory/in-memory-station-route-repository";
import {
  ChangeLineState,
  ConfigureStationRoute,
  GetCheck,
  MarkAccountPaid,
  MarkTableReady,
  OpenTable,
  PlaceTable,
  RealtimeHub,
  ReassignCheck,
  ReleaseTable,
  RequestCheck,
  TakeOrder,
  ViewStationQueue,
  ViewTableMap,
  ViewVenueMenu,
} from "@blackhole/orders/application/entry-port";
import { Clock as OrdersClock } from "@blackhole/orders/application/ports/clock";
import { DiningRoomRepository } from "@blackhole/orders/application/ports/dining-room-repository";
import { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
import { Printer } from "@blackhole/orders/application/ports/printer";
import { StationDirectory } from "@blackhole/orders/application/ports/station-directory";
import { StationRouteRepository } from "@blackhole/orders/application/ports/station-route-repository";
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
import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import {
  InMemoryAttendancePolicyRepository,
  InMemoryClockEntryCorrectionRepository,
} from "#src/composition/attendance-memory.js";
import { FactusSimulator } from "#src/composition/factus-simulator.js";
import { OrdersAccount } from "#src/composition/orders-account.js";
import { OrganizationVenueDirectory } from "#src/composition/organization-venue-directory.js";
import { OrganizationRegisterDirectory } from "#src/composition/register-directory.js";
import {
  PendingSalePrinter,
  RecordedDrawerAudit,
} from "#src/composition/sale-receipt.js";
import { StationRouteDirectory } from "#src/composition/station-route-directory.js";
import { AcceptCloudWriteController } from "#src/http/accept-cloud-write.controller.js";
import { AttendanceController } from "#src/http/attendance.controller.js";
import { AuthorizationController } from "#src/http/authorization.controller.js";
import { CashCountController } from "#src/http/cash-count.controller.js";
import { CashShiftController } from "#src/http/cash-shift.controller.js";
import { ChangeLineStateController } from "#src/http/change-line-state.controller.js";
import { ChargeCheckController } from "#src/http/charge-check.controller.js";
import { ConfigureStationRouteController } from "#src/http/configure-station-route.controller.js";
import { GetCheckController } from "#src/http/get-check.controller.js";
import { HealthController } from "#src/http/health.controller.js";
import {
  InvoicingController,
  NumberingRangeStore,
} from "#src/http/invoicing.controller.js";
import { OpenTableController } from "#src/http/open-table.controller.js";
import { OperateDevicesController } from "#src/http/operate-devices.controller.js";
import { OperateIdentityController } from "#src/http/operate-identity.controller.js";
import {
  OrdersRealtimeController,
  RealtimeSocketMiddleware,
} from "#src/http/orders-realtime.controller.js";
import { PlaceTableController } from "#src/http/place-table.controller.js";
import { ReadAuditController } from "#src/http/read-audit.controller.js";
import { ReassignCheckController } from "#src/http/reassign-check.controller.js";
import { ReleaseTableController } from "#src/http/release-table.controller.js";
import { RequestCheckController } from "#src/http/request-check.controller.js";
import { TakeOrderController } from "#src/http/take-order.controller.js";
import { TaxConfigurationController } from "#src/http/tax-configuration.controller.js";
import { TaxQuoteController } from "#src/http/tax-quote.controller.js";
import { UpdateMenuController } from "#src/http/update-menu.controller.js";
import { UpdateStructureController } from "#src/http/update-structure.controller.js";
import { ViewStationQueueController } from "#src/http/view-station-queue.controller.js";
import { ViewTableMapController } from "#src/http/view-table-map.controller.js";
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
  taxRules?: TaxRuleRepository;
  fiscalProfiles?: FiscalProfileRepository;
  diningRooms?: DiningRoomRepository;
  registers?: InMemoryCashRegisterRepository;
  charges?: MemoryChargeLedger;
  counts?: MemoryCashCounts;
  stationRoutes?: StationRouteRepository;
  printer?: Printer;
  realtime?: RealtimeHub;
  invoicingProvider?: InvoicingProvider;
  documentBalances?: MemoryDocumentBalances;
  creditNotes?: MemoryCreditNotes;
  creditNoteAudits?: MemoryCreditNoteAudit;
  numberingRanges?: MemoryNumberingRanges;
}

class OrdersClockAdapter extends OrdersClock {
  constructor(private readonly source: Clock) {
    super();
  }

  override now(): number {
    return this.source.now();
  }
}

@Module({})
export class ApplicationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RealtimeSocketMiddleware)
      .forRoutes(OrdersRealtimeController);
  }

  static register(dependencies: CloudApplicationDependencies): DynamicModule {
    const registers =
      dependencies.registers ?? new InMemoryCashRegisterRepository();
    const charges = dependencies.charges ?? new MemoryChargeLedger();
    const counts = dependencies.counts ?? new MemoryCashCounts();
    const countStore = counts as unknown as ConstructorParameters<
      typeof SubmitCount
    >[2];
    const invoicingProvider =
      dependencies.invoicingProvider ?? new UnconfiguredInvoicingProvider();
    const documentBalances =
      dependencies.documentBalances ?? new MemoryDocumentBalances();
    const creditNotes = dependencies.creditNotes ?? new MemoryCreditNotes();
    const creditNoteAudits =
      dependencies.creditNoteAudits ?? new MemoryCreditNoteAudit(creditNotes);
    const numberingRanges =
      dependencies.numberingRanges ?? new MemoryNumberingRanges();
    const salePrinter = new PendingSalePrinter();

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
        PlaceTableController,
        ConfigureStationRouteController,
        OpenTableController,
        ReleaseTableController,
        RequestCheckController,
        ReassignCheckController,
        TakeOrderController,
        ChangeLineStateController,
        ViewTableMapController,
        ViewStationQueueController,
        GetCheckController,
        OrdersRealtimeController,
        TaxQuoteController,
        TaxConfigurationController,
        InvoicingController,
        AttendanceController,
        CashShiftController,
        ChargeCheckController,
        CashCountController,
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
          provide: DiningRoomRepository,
          useValue:
            dependencies.diningRooms ?? new InMemoryDiningRoomRepository(),
        },
        {
          provide: StationRouteRepository,
          useValue:
            dependencies.stationRoutes ?? new InMemoryStationRouteRepository(),
        },
        {
          provide: PlaceTable,
          useFactory: (diningRoom: DiningRoomRepository) =>
            new PlaceTable(diningRoom),
          inject: [DiningRoomRepository],
        },
        {
          provide: ConfigureStationRoute,
          useFactory: (routes: StationRouteRepository) =>
            new ConfigureStationRoute(routes),
          inject: [StationRouteRepository],
        },
        {
          provide: OrdersClock,
          useFactory: (clock: Clock) => new OrdersClockAdapter(clock),
          inject: [Clock],
        },
        {
          provide: OpenTable,
          useFactory: (diningRoom: DiningRoomRepository, clock: OrdersClock) =>
            new OpenTable(diningRoom, clock),
          inject: [DiningRoomRepository, OrdersClock],
        },
        {
          provide: OpenShift,
          useFactory: (organizations: OrganizationRepository) =>
            new OpenShift(
              registers,
              new OrganizationRegisterDirectory(organizations),
            ),
          inject: [OrganizationRepository],
        },
        {
          provide: OrdersAccount,
          useFactory: (
            diningRoom: DiningRoomRepository,
            menus: MenuRepository,
            venues: VenueDirectory,
            clock: OrdersClock,
          ) =>
            new OrdersAccount(
              new GetCheck(diningRoom),
              new ViewVenueMenu(menus, venues, clock),
              new MarkAccountPaid(diningRoom),
            ),
          inject: [
            DiningRoomRepository,
            MenuRepository,
            VenueDirectory,
            OrdersClock,
          ],
        },
        {
          provide: PendingSalePrinter,
          useValue: salePrinter,
        },
        {
          provide: ChargeCheck,
          useFactory: (
            organizations: OrganizationRepository,
            accounts: OrdersAccount,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
          ) =>
            new ChargeCheck(
              new OrganizationRegisterDirectory(organizations),
              accounts,
              new ManualCardTerminal(),
              charges,
              salePrinter,
              new RecordedDrawerAudit(audits, digests, clock),
            ),
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
          useFactory: (organizations: OrganizationRepository) =>
            new SubmitCount(
              new OrganizationRegisterDirectory(organizations),
              registers,
              countStore,
            ),
          inject: [OrganizationRepository],
        },
        {
          provide: ApproveVariance,
          useFactory: (organizations: OrganizationRepository) =>
            new ApproveVariance(
              new OrganizationRegisterDirectory(organizations),
              countStore,
            ),
          inject: [OrganizationRepository],
        },
        {
          provide: CloseShift,
          useFactory: (organizations: OrganizationRepository) =>
            new CloseShift(
              new OrganizationRegisterDirectory(organizations),
              countStore,
              salePrinter,
            ),
          inject: [OrganizationRepository],
        },
        {
          provide: ReleaseTable,
          useFactory: (diningRoom: DiningRoomRepository) =>
            new ReleaseTable(diningRoom),
          inject: [DiningRoomRepository],
        },
        {
          provide: MarkTableReady,
          useFactory: (diningRoom: DiningRoomRepository) =>
            new MarkTableReady(diningRoom),
          inject: [DiningRoomRepository],
        },
        {
          provide: RequestCheck,
          useFactory: (
            diningRoom: DiningRoomRepository,
            clock: OrdersClock,
            printer: Printer,
            hub: RealtimeHub,
          ) => new RequestCheck(diningRoom, clock, printer, hub),
          inject: [DiningRoomRepository, OrdersClock, Printer, RealtimeHub],
        },
        {
          provide: ReassignCheck,
          useFactory: (diningRoom: DiningRoomRepository) =>
            new ReassignCheck(diningRoom),
          inject: [DiningRoomRepository],
        },
        {
          provide: Printer,
          useValue: dependencies.printer ?? new InMemoryPrinter(),
        },
        {
          provide: RealtimeHub,
          useValue: dependencies.realtime ?? new InMemoryRealtimeHub(),
        },
        {
          provide: StationDirectory,
          useFactory: (routes: StationRouteRepository) =>
            new StationRouteDirectory(routes),
          inject: [StationRouteRepository],
        },
        {
          provide: TakeOrder,
          useFactory: (
            diningRoom: DiningRoomRepository,
            menus: MenuRepository,
            stations: StationDirectory,
            printer: Printer,
            clock: OrdersClock,
            hub: RealtimeHub,
          ) => new TakeOrder(diningRoom, menus, stations, printer, clock, hub),
          inject: [
            DiningRoomRepository,
            MenuRepository,
            StationDirectory,
            Printer,
            OrdersClock,
            RealtimeHub,
          ],
        },
        {
          provide: ChangeLineState,
          useFactory: (
            diningRoom: DiningRoomRepository,
            clock: OrdersClock,
            hub: RealtimeHub,
          ) => new ChangeLineState(diningRoom, clock, hub),
          inject: [DiningRoomRepository, OrdersClock, RealtimeHub],
        },
        {
          provide: ViewTableMap,
          useFactory: (diningRoom: DiningRoomRepository) =>
            new ViewTableMap(diningRoom),
          inject: [DiningRoomRepository],
        },
        {
          provide: ViewStationQueue,
          useFactory: (
            diningRoom: DiningRoomRepository,
            routes: StationRouteRepository,
            clock: OrdersClock,
          ) => new ViewStationQueue(diningRoom, routes, clock),
          inject: [DiningRoomRepository, StationRouteRepository, OrdersClock],
        },
        {
          provide: GetCheck,
          useFactory: (diningRoom: DiningRoomRepository) =>
            new GetCheck(diningRoom),
          inject: [DiningRoomRepository],
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
        {
          provide: TaxRuleRepository,
          useValue: dependencies.taxRules ?? new InMemoryTaxRuleRepository(),
        },
        {
          provide: FiscalProfileRepository,
          useValue:
            dependencies.fiscalProfiles ??
            new InMemoryFiscalProfileRepository(),
        },
        {
          provide: CalculateTaxes,
          useFactory: (
            profiles: FiscalProfileRepository,
            rules: TaxRuleRepository,
          ) => new CalculateTaxes(profiles, rules),
          inject: [FiscalProfileRepository, TaxRuleRepository],
        },
        {
          provide: PublishTaxRule,
          useFactory: (rules: TaxRuleRepository) => new PublishTaxRule(rules),
          inject: [TaxRuleRepository],
        },
        {
          provide: AdoptFiscalTemplate,
          useFactory: (profiles: FiscalProfileRepository) =>
            new AdoptFiscalTemplate(profiles),
          inject: [FiscalProfileRepository],
        },
        { provide: InvoicingProvider, useValue: invoicingProvider },
        {
          provide: AttachBuyer,
          useFactory: (provider: InvoicingProvider) =>
            new AttachBuyer(provider),
          inject: [InvoicingProvider],
        },
        { provide: DocumentBalanceStore, useValue: documentBalances },
        {
          provide: SetDocumentBalance,
          useFactory: (balances: DocumentBalanceStore) =>
            new SetDocumentBalance(balances),
          inject: [DocumentBalanceStore],
        },
        { provide: CreditNoteRepository, useValue: creditNotes },
        { provide: CreditNoteAudit, useValue: creditNoteAudits },
        {
          provide: IssueCreditNote,
          useFactory: (
            provider: InvoicingProvider,
            notes: CreditNoteRepository,
            audits: CreditNoteAudit,
          ) => new IssueCreditNote(provider, notes, audits),
          inject: [InvoicingProvider, CreditNoteRepository, CreditNoteAudit],
        },
        { provide: NumberingRangeStore, useValue: numberingRanges },
      ],
    };
  }
}

interface StoredChargeLine {
  lineId: string;
  productId: string;
  priceCop: number;
  originTableId: string;
  menuClass: string;
}

interface StoredCharge {
  commandId: string;
  payment: Payment;
  closure: {
    id: string;
    status: "queued";
    commandId: string;
    checkId: string;
    tableId: string;
    registerId: string;
    paymentId: string;
    saleCop: number;
    changeCop: number;
    lines: readonly StoredChargeLine[];
    tenders: Payment["tenders"];
    tip: Payment["tip"];
  };
}

const chargeKey = (
  tenantId: string,
  venueId: string,
  commandId: string,
): string => `${tenantId}\u0000${venueId}\u0000${commandId}`;

export class MemoryChargeLedger {
  insertions = 0;

  private readonly charges = new Map<string, StoredCharge>();

  async findByCommand(
    tenantId: string,
    venueId: string,
    commandId: string,
  ): Promise<StoredCharge | null> {
    return this.charges.get(chargeKey(tenantId, venueId, commandId)) ?? null;
  }

  async insert(
    tenantId: string,
    venueId: string,
    charge: StoredCharge,
  ): Promise<void> {
    this.insertions += 1;
    this.charges.set(chargeKey(tenantId, venueId, charge.commandId), charge);
  }
}

const countKey = (
  tenantId: string,
  venueId: string,
  registerId: string,
): string => `${tenantId}\u0000${venueId}\u0000${registerId}`;

export class MemoryCashCounts {
  saves = 0;

  private readonly counts = new Map<string, object>();

  async find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<object | null> {
    return this.counts.get(countKey(tenantId, venueId, registerId)) ?? null;
  }

  async save(
    tenantId: string,
    venueId: string,
    registerId: string,
    count: object,
  ): Promise<void> {
    this.saves += 1;
    this.counts.set(countKey(tenantId, venueId, registerId), count);
  }
}

class UnconfiguredInvoicingProvider extends InvoicingProvider {
  override async validate(): Promise<void> {
    throw new Error("InvoicingProvider is not configured.");
  }
}

export class MemoryDocumentBalances extends DocumentBalanceStore {
  readonly saved: OpeningDocumentBalance[] = [];
  saves = 0;

  override async readRemaining(
    key: DocumentBalanceKey,
  ): Promise<number | null> {
    const found = this.saved.find(
      (row) =>
        row.companyId === key.companyId &&
        row.nit === key.nit &&
        row.siteId === key.siteId,
    );

    return found?.remaining ?? null;
  }

  override async saveRemaining(balance: OpeningDocumentBalance): Promise<void> {
    this.saves += 1;
    this.saved.push({ ...balance });
  }

  override async readCount(): Promise<number> {
    return 0;
  }

  override async saveCount(): Promise<void> {
    return undefined;
  }
}

export class MemoryCreditNotes extends CreditNoteRepository {
  readonly rows: CreditNote[] = [];

  override async insert(note: CreditNote): Promise<void> {
    this.rows.push({ ...note });
  }
}

export class MemoryCreditNoteAudit extends CreditNoteAudit {
  readonly calls: CreditNoteAuditCommand[] = [];
  readonly storedBeforeRecord: number[] = [];

  constructor(private readonly notes: MemoryCreditNotes) {
    super();
  }

  override async record(command: CreditNoteAuditCommand): Promise<void> {
    this.storedBeforeRecord.push(this.notes.rows.length);
    this.calls.push({ ...command });
  }
}

export class MemoryNumberingRanges extends NumberingRangeStore {
  readonly rows: NumberingRangeAssignment[] = [];
  saves = 0;

  override async save(
    range: NumberingRangeAssignment,
  ): Promise<NumberingRangeAssignment> {
    this.saves += 1;
    const stored = { ...range };
    this.rows.push(stored);

    return stored;
  }
}
