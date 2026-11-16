import { InMemoryClockEntryRepository } from "@blackhole/attendance/adapters/memory/in-memory-clock-entry-repository";
import { SheetJsHoursWorkbook } from "@blackhole/attendance/adapters/xlsx/hours-workbook";
import { AttendancePolicyRepository } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import { ClockEntryCorrectionRepository } from "@blackhole/attendance/application/ports/clock-entry-correction-repository";
import { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import { HoursWorkbook } from "@blackhole/attendance/application/ports/hours-workbook";
import { ManualCardTerminal } from "@blackhole/cash-register/adapters/manual-terminal/manual-card-terminal";
import { InMemoryCashRegisterRepository } from "@blackhole/cash-register/adapters/memory/in-memory-cash-register-repository";
import { MemoryLedgerCashFacts } from "@blackhole/cash-register/adapters/memory/ledger-cash-fact-reader";
import {
  type ActiveTipRule,
  AdjustTipSettlement,
  ApplyQrPayment,
  ApproveVariance,
  ChangeTender,
  ChargeCheck,
  ChargeClock,
  type ClosedTipSettlement,
  CloseShift,
  ConfigureTipRule,
  ConfirmQrPayment,
  OpenDrawer,
  OpenShift,
  OriginalPaymentReader,
  PaidAccountReader,
  type Payment,
  PaymentGateway,
  PrintTipSettlement,
  type QueuedSaleReceipt,
  type RecordedPaymentTip,
  ReopenPaidAccount,
  type SaleReceiptJob,
  Printer as SaleReceiptPrinter,
  SettleTips,
  StartQrPayment,
  SubmitCount,
  TipParticipantSource,
  TipPool,
  type TipPoolQuery,
  TipRuleStore,
  TipSettlementStore,
} from "@blackhole/cash-register/application/entry-port";
import {
  type NumberingRangeAssignment,
  shortageNotice,
} from "@blackhole/contracts";
import { InMemoryRecipeCatalogRepository } from "@blackhole/inventory/adapters/memory/in-memory-recipe-catalog-repository";
import {
  InMemoryPointOfSaleDirectory,
  InMemoryStockLedgerRepository,
  InMemoryStockMovementQueue,
} from "@blackhole/inventory/adapters/memory/in-memory-stock-ledger-repository";
import { DrizzleProductionRepository } from "@blackhole/inventory/adapters/postgres/drizzle-production-repository";
import { DrizzlePurchasingRepository } from "@blackhole/inventory/adapters/postgres/drizzle-purchasing-repository";
import {
  DrizzleIngredientClassification,
  DrizzleStockCountRepository,
} from "@blackhole/inventory/adapters/postgres/drizzle-stock-count-repository";
import {
  DrizzlePointOfSaleDirectory,
  DrizzleStockLedgerRepository,
  DrizzleStockMovementQueue,
} from "@blackhole/inventory/adapters/postgres/drizzle-stock-ledger-repository";
import { InMemoryProducibleQuantityRepository } from "@blackhole/inventory/adapters/memory/in-memory-producible-quantity-repository";
import { DrizzleProducibleQuantityRepository } from "@blackhole/inventory/adapters/postgres/drizzle-producible-quantity-repository";
import { DrizzleShortageRepository } from "@blackhole/inventory/adapters/postgres/drizzle-shortage-repository";
import { DrizzleTransferRepository } from "@blackhole/inventory/adapters/postgres/drizzle-transfer-repository";
import {
  AcceptStockLevels,
  ApproveAdjustment,
  ConfirmNoRestockToday,
  CreatePurchaseOrder,
  DestinationStock,
  ExplodeRecipe,
  MarkAlertSeen,
  ProjectProducibleQuantity,
  RecordOperationalWaste,
  RecordStockCount,
  RecordWaste,
  RegisterSaleConsumption,
  RemoveNoRestockToday,
  ResolveAlert,
  RestockFromAlert,
  ReturnStock,
  SetIngredientCategory,
  SetStockLevels,
  TransferStock,
} from "@blackhole/inventory/application/entry-port";
import {
  AvailabilityPublisher,
  type AvailabilityChanged,
} from "@blackhole/inventory/application/ports/availability-publisher";
import { InventoryLocationDirectory } from "@blackhole/inventory/application/ports/inventory-location-directory";
import { LowUnitsThreshold } from "@blackhole/inventory/application/ports/low-units-threshold";
import { OperationGeneration } from "@blackhole/inventory/application/ports/operation-generation";
import { PointOfSaleDirectory } from "@blackhole/inventory/application/ports/point-of-sale-directory";
import { ProductionRepository } from "@blackhole/inventory/application/ports/production-repository";
import { PublishedPurchaseFactor } from "@blackhole/inventory/application/ports/published-purchase-factor";
import { PurchasingRepository } from "@blackhole/inventory/application/ports/purchasing-repository";
import {
  RecipeCatalogRepository,
  type RecipePublication,
} from "@blackhole/inventory/application/ports/recipe-catalog-repository";
import { RecipeVersionReader } from "@blackhole/inventory/application/ports/recipe-version";
import { RecipeWorkbook } from "@blackhole/inventory/application/ports/recipe-workbook";
import { ReferenceCostList } from "@blackhole/inventory/application/ports/reference-cost";
import { SitePrice } from "@blackhole/inventory/application/ports/site-price";
import { StockAlertPublisher } from "@blackhole/inventory/application/ports/stock-alert-publisher";
import {
  CONSUMPTION_ROLE,
  StockLedgerRepository,
} from "@blackhole/inventory/application/ports/stock-ledger-repository";
import { SupplyingLocations } from "@blackhole/inventory/application/ports/supplying-locations";
import { StockMovementQueue } from "@blackhole/inventory/application/ports/stock-movement-queue";
import { TransferRepository } from "@blackhole/inventory/application/ports/transfer-repository";
import { TransferVoucher } from "@blackhole/inventory/application/ports/transfer-voucher";
import { VenueDirectory as RecipeVenueDirectory } from "@blackhole/inventory/application/ports/venue-directory";
import { WarehouseSupply } from "@blackhole/inventory/application/ports/warehouse-supply";
import { NoRestockToday } from "@blackhole/inventory/domain";
import { InMemoryFiscalProfileRepository } from "@blackhole/invoicing/adapters/memory/in-memory-fiscal-profile-repository";
import { InMemoryTaxRuleRepository } from "@blackhole/invoicing/adapters/memory/in-memory-tax-rule-repository";
import {
  AdoptFiscalTemplate,
  ApproveReinvoice,
  AttachBuyer,
  CalculateTaxes,
  type CreditNote,
  CreditNoteAudit,
  type CreditNoteAuditCommand,
  CreditNoteRepository,
  type DocumentBalanceKey,
  DocumentBalanceStore,
  type DocumentIssuance,
  InvoicingProvider,
  IssueCreditNote,
  IssueDocument,
  LookUpPortalBuyer,
  type OpeningDocumentBalance,
  PublishTaxRule,
  QueuedClosureReader,
  RequestReinvoice,
  SalesDocumentRepository,
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
  ConfirmGuestTold,
  GetCheck,
  MarkAccountPaid,
  MarkLineUndeliverable,
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
  ViewVenueMenu,
  VoidAccount,
  VoidLine,
  WithdrawUnstartedLines,
} from "@blackhole/orders/application/entry-port";
import { Clock as OrdersClock } from "@blackhole/orders/application/ports/clock";
import { DiningRoomRepository } from "@blackhole/orders/application/ports/dining-room-repository";
import { ApplyMenuAvailability } from "@blackhole/orders/application/apply-menu-availability/apply-menu-availability";
import { MenuRepository } from "@blackhole/orders/application/ports/menu-repository";
import { Printer } from "@blackhole/orders/application/ports/printer";
import { QrOrderIntentRepository } from "@blackhole/orders/application/ports/qr-order-intent-repository";
import { StationDirectory } from "@blackhole/orders/application/ports/station-directory";
import { StationRouteRepository } from "@blackhole/orders/application/ports/station-route-repository";
import { TableQrRepository } from "@blackhole/orders/application/ports/table-qr-repository";
import { VenueDirectory } from "@blackhole/orders/application/ports/venue-directory";
import { Sha256AuditDigest } from "@blackhole/platform/adapters/crypto/sha256-audit-digest";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
import { InMemoryPendingIssuance } from "@blackhole/platform/adapters/memory/in-memory-pending-issuance";
import { InMemoryProviderRateGate } from "@blackhole/platform/adapters/memory/in-memory-provider-rate-gate";
import {
  ConsumeAuthorization,
  CountExecutedOperations,
  DetectUnusualBehavior,
  EvaluatePermission,
  ReadControlReport,
  RecordAuditEvent,
} from "@blackhole/platform/application/entry-port";
import { AuditDigest } from "@blackhole/platform/application/ports/audit-digest";
import {
  type AuditEvent,
  AuditRepository,
} from "@blackhole/platform/application/ports/audit-repository";
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
  type ConfiguredPrinter,
  type DispatchablePrintJob,
  DispatchJobRepository,
  type DispatchPrinter,
  DispatchPrinterRepository,
  DispatchPrintJobs,
  EnqueuePrintJob,
  type PrintDelivery,
  PrinterRepository,
  type PrintJob,
  PrintJobRepository,
  PrintTransport,
} from "@blackhole/printing/application/entry-port";
import {
  ReadCashReport,
  ReadSalesReport,
  ReadStaffReport,
  ReadTimeReport,
} from "@blackhole/reporting/application/entry-port";
import {
  type DynamicModule,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  type Provider,
} from "@nestjs/common";
import {
  InMemoryAttendancePolicyRepository,
  InMemoryClockEntryCorrectionRepository,
} from "#src/composition/attendance-memory.js";
import { AttendanceTipParticipants } from "#src/composition/attendance-tip-participants.js";
import { ClosedShiftReader } from "#src/composition/closed-shift-reader.js";
import { CloudPreBillLink } from "#src/composition/cloud-pre-bill-link.js";
import { ExcelRecipeWorkbook } from "#src/composition/excel-recipe-workbook.js";
import { FactusSimulator } from "#src/composition/factus-simulator.js";
import {
  CatalogPublishedPurchaseFactor,
  OrganizationInventoryLocationDirectory,
  PostgresPurchaseAverageCost,
  PurchaseAverageCost,
} from "#src/composition/inventory-location-directory.js";
import { MenuSitePrice } from "#src/composition/menu-site-price.js";
import {
  MissingOriginalPaymentReader,
  MissingPaidAccountReader,
} from "#src/composition/missing-sale-readers.js";
import { OrdersAccount } from "#src/composition/orders-account.js";
import { OrganizationVenueDirectory } from "#src/composition/organization-venue-directory.js";
import {
  postgresQrTable,
  type QrTableDatabase,
} from "#src/composition/postgres-qr-table.js";
import {
  applyQrPaymentFor,
  ClosedQrTableAccess,
  confirmQrPaymentFor,
  MemoryQrPayments,
  qrGatewayFor,
  startQrPaymentFor,
} from "#src/composition/qr-table-payment.js";
import { OrdersRecipeVenueDirectory } from "#src/composition/recipe-venue-directory.js";
import { OrganizationRegisterDirectory } from "#src/composition/register-directory.js";
import {
  createReportingFacts,
  PermissionReportAccess,
  ReportingFacts,
  VenueOpenShift,
} from "#src/composition/reporting-facts.js";
import {
  CatalogRecipeVersionReader,
  CatalogReferenceCostList,
  currentGeneration,
  StoredStockAlertPublisher,
  VenueOperationGeneration,
} from "#src/composition/sale-consumption.js";
import {
  PendingSalePrinter,
  RecordedDrawerAudit,
} from "#src/composition/sale-receipt.js";
import { StationRouteDirectory } from "#src/composition/station-route-directory.js";
import { AcceptCloudWriteController } from "#src/http/accept-cloud-write.controller.js";
import { AdjustTipSettlementController } from "#src/http/adjust-tip-settlement.controller.js";
import { ApplyCourtesyController } from "#src/http/apply-courtesy.controller.js";
import { ApplyDiscountController } from "#src/http/apply-discount.controller.js";
import { AttendanceController } from "#src/http/attendance.controller.js";
import { AuthorizationController } from "#src/http/authorization.controller.js";
import { CashCountController } from "#src/http/cash-count.controller.js";
import { CashShiftController } from "#src/http/cash-shift.controller.js";
import { ChangeLineStateController } from "#src/http/change-line-state.controller.js";
import { ChangePriceController } from "#src/http/change-price.controller.js";
import { ChangeTenderController } from "#src/http/change-tender.controller.js";
import { ChargeCheckController } from "#src/http/charge-check.controller.js";
import { ConfigureStationRouteController } from "#src/http/configure-station-route.controller.js";
import { ConfigureTipRuleController } from "#src/http/configure-tip-rule.controller.js";
import { DetectUnusualBehaviorController } from "#src/http/detect-unusual-behavior.controller.js";
import { GetCheckController } from "#src/http/get-check.controller.js";
import { HealthController } from "#src/http/health.controller.js";
import {
  InvoicingController,
  NumberingRangeStore,
} from "#src/http/invoicing.controller.js";
import {
  ConfirmNoRestockFlow,
  NoRestockCatalog,
  NoRestockController,
} from "#src/http/no-restock.controller.js";
import { OpenDrawerController } from "#src/http/open-drawer.controller.js";
import { OpenTableController } from "#src/http/open-table.controller.js";
import { OperateDevicesController } from "#src/http/operate-devices.controller.js";
import { OperateIdentityController } from "#src/http/operate-identity.controller.js";
import {
  OrdersRealtimeController,
  RealtimeSocketMiddleware,
} from "#src/http/orders-realtime.controller.js";
import {
  ShortageAlertsController,
  ShortageTransactions,
} from "#src/http/shortage-alerts.controller.js";
import {
  ShortageNoticeFeed,
  ShortageRealtimeController,
} from "#src/http/shortage-realtime.controller.js";
import { PlaceTableController } from "#src/http/place-table.controller.js";
import { PortalController } from "#src/http/portal.controller.js";
import { PrintTipSettlementController } from "#src/http/print-tip-settlement.controller.js";
import {
  MemoryReprintAudit,
  PrintingController,
  ReprintCap,
} from "#src/http/printing.controller.js";
import { ProductionController } from "#src/http/production.controller.js";
import { PurchasingController } from "#src/http/purchasing.controller.js";
import {
  QrPaymentController,
  QrTableAccess,
} from "#src/http/qr-payment.controller.js";
import { ReadAuditController } from "#src/http/read-audit.controller.js";
import { ReadControlReportController } from "#src/http/read-control-report.controller.js";
import { ReadSiteReportController } from "#src/http/read-site-report.controller.js";
import { ReassignCheckController } from "#src/http/reassign-check.controller.js";
import { RecipeCatalogController } from "#src/http/recipe-catalog.controller.js";
import { ReinvoiceController } from "#src/http/reinvoice.controller.js";
import { ReleaseTableController } from "#src/http/release-table.controller.js";
import { ReopenPaidAccountController } from "#src/http/reopen-paid-account.controller.js";
import { RequestCheckController } from "#src/http/request-check.controller.js";
import { SettleTipsController } from "#src/http/settle-tips.controller.js";
import {
  CountSessionReader,
  StockOperationsController,
} from "#src/http/stock-operations.controller.js";
import { TableQrController } from "#src/http/table-qr.controller.js";
import { TableQrAdminController } from "#src/http/table-qr-admin.controller.js";
import { TakeOrderController } from "#src/http/take-order.controller.js";
import { TaxConfigurationController } from "#src/http/tax-configuration.controller.js";
import { TaxQuoteController } from "#src/http/tax-quote.controller.js";
import {
  OrganizationWarehouseSupply,
  PendingTransferVoucher,
  PostgresDestinationStock,
  PostgresTransferStock,
  TransfersController,
} from "#src/http/transfers.controller.js";
import { UpdateMenuController } from "#src/http/update-menu.controller.js";
import {
  StructurePrinters,
  UpdateStructureController,
} from "#src/http/update-structure.controller.js";
import { ViewStationQueueController } from "#src/http/view-station-queue.controller.js";
import { ViewTableMapController } from "#src/http/view-table-map.controller.js";
import { ViewVenueMenuController } from "#src/http/view-venue-menu.controller.js";
import { VoidAccountController } from "#src/http/void-account.controller.js";
import { VoidLineController } from "#src/http/void-line.controller.js";

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
  recipeCatalogs?: RecipeCatalogRepository;
  recipeWorkbook?: RecipeWorkbook;
  digests?: AuditDigest;
  clockEntries?: ClockEntryRepository;
  corrections?: ClockEntryCorrectionRepository;
  policies?: AttendancePolicyRepository;
  workbook?: HoursWorkbook;
  taxRules?: TaxRuleRepository;
  fiscalProfiles?: FiscalProfileRepository;
  diningRooms?: DiningRoomRepository;
  tableQr?: TableQrRepository;
  qrIntents?: QrOrderIntentRepository;
  ordersDatabase?: QrTableDatabase;
  shifts?: OpenShiftReader;
  registers?: InMemoryCashRegisterRepository;
  charges?: MemoryChargeLedger;
  counts?: MemoryCashCounts;
  stationRoutes?: StationRouteRepository;
  printer?: Printer;
  realtime?: RealtimeHub;
  portalPreBillEnabled?: boolean;
  oneTimeCodeSender?: "unconfigured";
  portalBuyerStore?: MemoryPortalBuyerStore;
  portalLookupLimited?: boolean;
  reinvoiceRequests?: MemoryReinvoiceRequests;
  invoicingProvider?: InvoicingProvider;
  documentBalances?: MemoryDocumentBalances;
  creditNotes?: MemoryCreditNotes;
  creditNoteAudits?: MemoryCreditNoteAudit;
  numberingRanges?: MemoryNumberingRanges;
  reprintCap?: ReprintCap;
  reprintAudits?: MemoryReprintAudit;
  structurePrinters?: StructurePrinters;
  paidAccounts?: PaidAccountReader;
  originalPayments?: OriginalPaymentReader;
  inventoryDatabase?: ConstructorParameters<
    typeof DrizzleStockLedgerRepository
  >[0];
  saleConsumptionEnabled?: boolean;
  purchasingEnabled?: boolean;
  productionEnabled?: boolean;
  transfersEnabled?: boolean;
  noRestockTodayEnabled?: boolean;
  wasteAndCountsEnabled?: boolean;
  shortageAlertsEnabled?: boolean;
}

const openStockLedger = (
  database:
    | ConstructorParameters<typeof DrizzleStockLedgerRepository>[0]
    | undefined,
) => {
  if (database) {
    const ledger = new DrizzleStockLedgerRepository(database);

    return {
      ledger,
      movements: new DrizzleStockMovementQueue(ledger),
      pointsOfSale: new DrizzlePointOfSaleDirectory(database),
    };
  }

  const ledger = new InMemoryStockLedgerRepository();

  return {
    ledger,
    movements: new InMemoryStockMovementQueue(ledger),
    pointsOfSale: new InMemoryPointOfSaleDirectory(),
  };
};

const openPurchasing = (
  database:
    | ConstructorParameters<typeof DrizzleStockLedgerRepository>[0]
    | undefined,
  enabled: boolean,
): { controllers: (typeof PurchasingController)[]; providers: Provider[] } => {
  if (!enabled) {
    return { controllers: [], providers: [] };
  }

  if (!database) {
    throw new Error("Purchasing requires PostgreSQL.");
  }

  const purchasing = new DrizzlePurchasingRepository(database);

  return {
    controllers: [PurchasingController],
    providers: [
      { provide: PurchasingRepository, useValue: purchasing },
      {
        provide: InventoryLocationDirectory,
        useFactory: (organizations: OrganizationRepository) =>
          new OrganizationInventoryLocationDirectory(organizations),
        inject: [OrganizationRepository],
      },
      {
        provide: PublishedPurchaseFactor,
        useFactory: (
          catalogs: RecipeCatalogRepository,
          organizations: OrganizationRepository,
        ) => new CatalogPublishedPurchaseFactor(catalogs, organizations),
        inject: [RecipeCatalogRepository, OrganizationRepository],
      },
      {
        provide: PurchaseAverageCost,
        useValue: new PostgresPurchaseAverageCost(purchasing),
      },
    ],
  };
};

const openProduction = (
  database:
    | ConstructorParameters<typeof DrizzleStockLedgerRepository>[0]
    | undefined,
  enabled: boolean,
): { controllers: (typeof ProductionController)[]; providers: Provider[] } => {
  if (!enabled) {
    return { controllers: [], providers: [] };
  }

  if (!database) {
    throw new Error("Production requires PostgreSQL.");
  }

  return {
    controllers: [ProductionController],
    providers: [
      {
        provide: ProductionRepository,
        useValue: new DrizzleProductionRepository(database),
      },
    ],
  };
};

const openTransfers = (
  database:
    | ConstructorParameters<typeof DrizzleStockLedgerRepository>[0]
    | undefined,
  enabled: boolean,
): { controllers: (typeof TransfersController)[]; providers: Provider[] } => {
  if (!enabled) {
    return { controllers: [], providers: [] };
  }

  if (!database) {
    throw new Error("Transfers require PostgreSQL.");
  }

  const transfers = new DrizzleTransferRepository(database);

  return {
    controllers: [TransfersController],
    providers: [
      { provide: TransferRepository, useValue: transfers },
      {
        provide: TransferStock,
        useValue: new PostgresTransferStock(database, transfers),
      },
      {
        provide: DestinationStock,
        useValue: new PostgresDestinationStock(transfers),
      },
      {
        provide: WarehouseSupply,
        useFactory: (organizations: OrganizationRepository) =>
          new OrganizationWarehouseSupply(organizations),
        inject: [OrganizationRepository],
      },
      { provide: TransferVoucher, useValue: new PendingTransferVoucher() },
    ],
  };
};

const openNoRestock = (
  database:
    | ConstructorParameters<typeof DrizzleStockLedgerRepository>[0]
    | undefined,
  enabled: boolean,
): { controllers: (typeof NoRestockController)[]; providers: Provider[] } => {
  if (!enabled) {
    return {
      controllers: [],
      providers: [
        {
          provide: NotRestockedProductReader,
          useValue: new NotRestockedProductReader(null),
        },
      ],
    };
  }

  if (!database) {
    throw new Error("Not restocked today requires PostgreSQL.");
  }

  const marks = new PostgresNoRestockMarks(database as NoRestockDatabase);
  const told = new MemoryGuestTold();

  return {
    controllers: [NoRestockController],
    providers: [
      {
        provide: NotRestockedProductReader,
        useValue: new NotRestockedProductReader(marks),
      },
      { provide: NoRestockCatalog, useValue: marks },
      {
        provide: ConfirmGuestTold,
        useFactory: (
          dining: DiningRoomRepository,
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
        ) =>
          new ConfirmGuestTold(
            dining,
            told,
            new RecordAuditEvent(audits, digests, clock),
          ),
        inject: [DiningRoomRepository, AuditRepository, AuditDigest, Clock],
      },
      {
        provide: RemoveNoRestockToday,
        useFactory: (
          authorizations: AuthorizationRepository,
          sessions: SessionReader,
          identities: IdentityReader,
          authorizationClock: AuthorizationClock,
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
        ) =>
          new RemoveNoRestockToday(
            marks,
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
            new RecordAuditEvent(audits, digests, clock),
            true,
          ),
        inject: [
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
        provide: MarkLineUndeliverable,
        useFactory: (
          dining: DiningRoomRepository,
          ordersClock: OrdersClock,
          hub: RealtimeHub,
        ) => new MarkLineUndeliverable(dining, ordersClock, hub),
        inject: [DiningRoomRepository, OrdersClock, RealtimeHub],
      },
      {
        provide: ConfirmNoRestockFlow,
        useFactory: (
          authorizations: AuthorizationRepository,
          sessions: SessionReader,
          identities: IdentityReader,
          authorizationClock: AuthorizationClock,
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
          dining: DiningRoomRepository,
          hub: RealtimeHub,
        ) =>
          new CloudConfirmNoRestockFlow(
            marks,
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
            audits,
            digests,
            clock,
            dining,
            hub,
          ),
        inject: [
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
          AuditRepository,
          AuditDigest,
          Clock,
          DiningRoomRepository,
          RealtimeHub,
        ],
      },
    ],
  };
};

const openWasteAndCounts = (
  database:
    | ConstructorParameters<typeof DrizzleStockLedgerRepository>[0]
    | undefined,
  enabled: boolean,
): {
  controllers: (typeof StockOperationsController)[];
  providers: Provider[];
} => {
  if (!enabled) {
    return { controllers: [], providers: [] };
  }

  if (!database) {
    throw new Error("Waste and counts require PostgreSQL.");
  }

  const counts = new DrizzleStockCountRepository(database);
  const classifications = new DrizzleIngredientClassification(database);

  return {
    controllers: [StockOperationsController],
    providers: [
      {
        provide: CountSessionReader,
        useValue: {
          sessionOf: (tenantId: string, documentId: string) =>
            counts.sessionOf(tenantId, documentId),
        },
      },
      {
        provide: RecordOperationalWaste,
        useFactory: (
          ledger: StockLedgerRepository,
          queue: StockMovementQueue,
          authorizations: AuthorizationRepository,
          sessions: SessionReader,
          identities: IdentityReader,
          authorizationClock: AuthorizationClock,
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
        ) =>
          new RecordOperationalWaste(
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
            ledger,
            queue,
            new RecordAuditEvent(audits, digests, clock),
          ),
        inject: [
          StockLedgerRepository,
          StockMovementQueue,
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
        provide: RecordStockCount,
        useFactory: (
          authorizations: AuthorizationRepository,
          sessions: SessionReader,
          identities: IdentityReader,
          authorizationClock: AuthorizationClock,
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
          catalogs: RecipeCatalogRepository,
          organizations: OrganizationRepository,
        ) =>
          new RecordStockCount(
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
            counts,
            classifications,
            new CatalogPublishedPurchaseFactor(catalogs, organizations),
            new RecordAuditEvent(audits, digests, clock),
          ),
        inject: [
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
          AuditRepository,
          AuditDigest,
          Clock,
          RecipeCatalogRepository,
          OrganizationRepository,
        ],
      },
      {
        provide: ApproveAdjustment,
        useFactory: (
          authorizations: AuthorizationRepository,
          sessions: SessionReader,
          identities: IdentityReader,
          authorizationClock: AuthorizationClock,
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
        ) =>
          new ApproveAdjustment(
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
            counts,
            new RecordAuditEvent(audits, digests, clock),
          ),
        inject: [
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
        provide: SetIngredientCategory,
        useValue: new SetIngredientCategory(classifications),
      },
    ],
  };
};

class PostgresShortageNoticeFeed extends ShortageNoticeFeed {
  constructor(private readonly shortages: DrizzleShortageRepository) {
    super();
  }

  override async list(tenantId: string, venueId: string) {
    const open = await this.shortages.listOpenShortages(tenantId, venueId);
    const notices = [];

    for (const row of open) {
      const stored = await this.shortages.listRoleNotices(
        tenantId,
        row.alert.id,
      );

      for (const notice of stored) {
        if (notice.venueId !== venueId) {
          continue;
        }

        const parsed = shortageNotice.safeParse({
          alertId: notice.alertId,
          kind: notice.kind,
          severity: notice.severity,
          role: notice.role,
          venueId: notice.venueId,
        });

        if (parsed.success) {
          notices.push(parsed.data);
        }
      }
    }

    return notices;
  }
}

class PostgresShortageTransactions extends ShortageTransactions {
  override run<T>(
    _tenantId: string,
    work: (tx: Parameters<RestockFromAlert["execute"]>[0]) => Promise<T>,
  ): Promise<T> {
    return work({
      balance: () => Promise.resolve(0),
    });
  }
}

const openShortageAlerts = (
  database:
    | ConstructorParameters<typeof DrizzleStockLedgerRepository>[0]
    | undefined,
  enabled: boolean,
): {
  controllers: (
    | typeof ShortageAlertsController
    | typeof ShortageRealtimeController
  )[];
  providers: Provider[];
} => {
  if (!enabled) {
    return { controllers: [], providers: [] };
  }

  if (!database) {
    throw new Error("Shortage alerts require PostgreSQL.");
  }

  const shortages = new DrizzleShortageRepository(database);
  const orders = new CreatePurchaseOrder(
    new DrizzlePurchasingRepository(database),
  );

  return {
    controllers: [ShortageAlertsController, ShortageRealtimeController],
    providers: [
      {
        provide: ShortageTransactions,
        useValue: new PostgresShortageTransactions(),
      },
      {
        provide: ShortageNoticeFeed,
        useValue: new PostgresShortageNoticeFeed(shortages),
      },
      {
        provide: SetStockLevels,
        useFactory: (
          authorizations: AuthorizationRepository,
          sessions: SessionReader,
          identities: IdentityReader,
          authorizationClock: AuthorizationClock,
        ) =>
          new SetStockLevels(
            shortages,
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
          ),
        inject: [
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
        ],
      },
      {
        provide: AcceptStockLevels,
        useFactory: (
          authorizations: AuthorizationRepository,
          sessions: SessionReader,
          identities: IdentityReader,
          authorizationClock: AuthorizationClock,
        ) =>
          new AcceptStockLevels(
            shortages,
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
          ),
        inject: [
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
        ],
      },
      {
        provide: MarkAlertSeen,
        useFactory: (
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
        ) =>
          new MarkAlertSeen(shortages, {
            record: async (command) => {
              await new RecordAuditEvent(audits, digests, clock).execute(
                command,
              );
            },
          }),
        inject: [AuditRepository, AuditDigest, Clock],
      },
      {
        provide: ResolveAlert,
        useFactory: (
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
        ) =>
          new ResolveAlert(shortages, {
            record: async (command) => {
              await new RecordAuditEvent(audits, digests, clock).execute(
                command,
              );
            },
          }),
        inject: [AuditRepository, AuditDigest, Clock],
      },
      {
        provide: RestockFromAlert,
        useFactory: (
          organizations: OrganizationRepository,
          authorizations: AuthorizationRepository,
          sessions: SessionReader,
          identities: IdentityReader,
          authorizationClock: AuthorizationClock,
          audits: AuditRepository,
          digests: AuditDigest,
          clock: Clock,
        ) =>
          new RestockFromAlert(
            shortages,
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
            {
              locationIds: async (tenantId, siteId) => {
                const organization = await organizations.load(tenantId);

                return (
                  organization?.locations
                    .filter(
                      (location) =>
                        location.kind === "warehouse" &&
                        location.venueId === siteId,
                    )
                    .map((location) => location.id) ?? []
                );
              },
            },
            {
              request: (command) =>
                Promise.resolve(`transfer_${command.alertId}`),
            },
            orders,
            {
              record: async (command) => {
                await new RecordAuditEvent(audits, digests, clock).execute(
                  command,
                );
              },
            },
          ),
        inject: [
          OrganizationRepository,
          AuthorizationRepository,
          SessionReader,
          IdentityReader,
          AuthorizationClock,
          AuditRepository,
          AuditDigest,
          Clock,
        ],
      },
    ],
  };
};

class OrdersClockAdapter extends OrdersClock {
  constructor(private readonly source: Clock) {
    super();
  }

  override now(): number {
    return this.source.now();
  }
}

class ChargeClockAdapter extends ChargeClock {
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
      .forRoutes(OrdersRealtimeController, ShortageRealtimeController);
  }

  static register(dependencies: CloudApplicationDependencies): DynamicModule {
    const oneTimeCodeSender =
      dependencies.oneTimeCodeSender === "unconfigured"
        ? new UnconfiguredOneTimeCodeSender()
        : new ConfiguredOneTimeCodeSender();
    const portalBuyerStore =
      dependencies.portalBuyerStore ?? new MemoryPortalBuyerStore();
    const portalLookupLimiter = dependencies.portalLookupLimited
      ? new RefusingPortalLookupLimiter()
      : new AllowingPortalLookupLimiter();
    const reinvoiceRequests =
      dependencies.reinvoiceRequests ?? new MemoryReinvoiceRequests();
    const registers =
      dependencies.registers ?? new InMemoryCashRegisterRepository();
    const qrPayments = new MemoryQrPayments();
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
    const tipRules = new MemoryTipRules();
    const tipPool = new MemoryTipPool();
    const tipSettlements = new MemoryTipSettlements();
    const tipPrintJobs = new MemoryTipPrintJobs();
    const tipPrinters = new MemoryTipPrinters();
    const tipDispatchJobs = new MemoryTipDispatchJobs(tipPrintJobs);
    const tipDispatchPrinters = new MemoryTipDispatchPrinters(tipPrinters);
    const tipPrintTransport = new MemoryTipPrintTransport();
    const reprintCap = dependencies.reprintCap ?? new ReprintCap(null);
    const reprintAudits =
      dependencies.reprintAudits ?? new MemoryReprintAudit();
    const structurePrinters =
      dependencies.structurePrinters ?? new StructurePrinters();
    const qrTable = dependencies.ordersDatabase
      ? postgresQrTable(dependencies.ordersDatabase)
      : null;
    const stock = openStockLedger(dependencies.inventoryDatabase);
    const menus = dependencies.menus ?? new InMemoryMenuRepository();
    const ordersVenues = new OrganizationVenueDirectory(
      dependencies.organizations,
    );
    const recipeVenues = new OrdersRecipeVenueDirectory(ordersVenues);
    const realtimeHub = dependencies.realtime ?? new InMemoryRealtimeHub();
    const projections = dependencies.inventoryDatabase
      ? new DrizzleProducibleQuantityRepository(dependencies.inventoryDatabase)
      : new InMemoryProducibleQuantityRepository();
    const recipeCatalogs =
      dependencies.recipeCatalogs ?? new InMemoryRecipeCatalogRepository();
    let explodeRecipe: ExplodeRecipe | undefined;
    const projectProducible = (
      tenantId: string,
    ): ProjectProducibleQuantity => {
      if (explodeRecipe === undefined) {
        throw new Error("The recipe explosion is not ready.");
      }

      return new ProjectProducibleQuantity(
        explodeRecipe,
        recipeVenues,
        stock.pointsOfSale,
        stock.ledger,
        projections,
        emptySupplyingLocations,
        new MenuLowUnitsThreshold(menus, ordersVenues),
        new MenuAvailabilityPublisher(
          tenantId,
          new ApplyMenuAvailability(menus, ordersVenues, realtimeHub),
        ),
      );
    };
    const projectingCatalogs = new ProjectingRecipeCatalog(
      recipeCatalogs,
      async (publication) => {
        const organization = await dependencies.organizations.load(
          publication.tenantId,
        );

        if (organization === null || explodeRecipe === undefined) {
          return;
        }

        for (const venue of organization.venues) {
          if (venue.brandId !== publication.brandId) {
            continue;
          }

          for (const recipe of publication.recipes) {
            try {
              await projectProducible(publication.tenantId).execute({
                kind: "recipe",
                tenantId: publication.tenantId,
                siteId: venue.id,
                productId: recipe.productId,
                ...(recipe.variantId === undefined
                  ? {}
                  : { variantId: recipe.variantId }),
              });
            } catch (error: unknown) {
              if (isMissingPointOfSale(error)) {
                continue;
              }

              throw error;
            }
          }
        }
      },
    );
    explodeRecipe = new ExplodeRecipe(projectingCatalogs);
    const saleConsumptionEnabled = dependencies.saleConsumptionEnabled === true;
    const purchasing = openPurchasing(
      dependencies.inventoryDatabase,
      dependencies.purchasingEnabled === true,
    );
    const production = openProduction(
      dependencies.inventoryDatabase,
      dependencies.productionEnabled === true,
    );
    const transfers = openTransfers(
      dependencies.inventoryDatabase,
      dependencies.transfersEnabled === true,
    );
    const noRestock = openNoRestock(
      dependencies.inventoryDatabase,
      dependencies.noRestockTodayEnabled === true,
    );
    const wasteAndCounts = openWasteAndCounts(
      dependencies.inventoryDatabase,
      dependencies.wasteAndCountsEnabled === true,
    );
    const shortageAlerts = openShortageAlerts(
      dependencies.inventoryDatabase,
      dependencies.shortageAlertsEnabled === true,
    );

    return {
      module: ApplicationModule,
      controllers: [
        AcceptCloudWriteController,
        UpdateStructureController,
        PrintingController,
        OperateIdentityController,
        OperateDevicesController,
        AuthorizationController,
        ReadAuditController,
        ReadControlReportController,
        ReadSiteReportController,
        DetectUnusualBehaviorController,
        UpdateMenuController,
        RecipeCatalogController,
        ViewVenueMenuController,
        PlaceTableController,
        ConfigureStationRouteController,
        OpenTableController,
        ReleaseTableController,
        RequestCheckController,
        ReassignCheckController,
        TakeOrderController,
        VoidLineController,
        VoidAccountController,
        ApplyDiscountController,
        ApplyCourtesyController,
        ChangePriceController,
        OpenDrawerController,
        ConfigureTipRuleController,
        SettleTipsController,
        AdjustTipSettlementController,
        PrintTipSettlementController,
        ReopenPaidAccountController,
        ChangeTenderController,
        ChangeLineStateController,
        ViewTableMapController,
        ViewStationQueueController,
        GetCheckController,
        OrdersRealtimeController,
        TaxQuoteController,
        TaxConfigurationController,
        InvoicingController,
        PortalController,
        ReinvoiceController,
        TableQrController,
        TableQrAdminController,
        AttendanceController,
        CashShiftController,
        ChargeCheckController,
        CashCountController,
        QrPaymentController,
        HealthController,
        ...purchasing.controllers,
        ...production.controllers,
        ...transfers.controllers,
        ...noRestock.controllers,
        ...wasteAndCounts.controllers,
        ...shortageAlerts.controllers,
      ],
      providers: [
        ...purchasing.providers,
        ...production.providers,
        ...transfers.providers,
        ...noRestock.providers,
        ...wasteAndCounts.providers,
        ...shortageAlerts.providers,
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
          useValue: menus,
        },
        {
          provide: TableQrRepository,
          useValue:
            dependencies.tableQr ??
            qrTable?.tokens ??
            new InMemoryTableQrRepository(),
        },
        {
          provide: QrOrderIntentRepository,
          useValue:
            dependencies.qrIntents ??
            qrTable?.intents ??
            new InMemoryQrOrderIntentRepository(),
        },
        {
          provide: DiningRoomRepository,
          useValue:
            dependencies.diningRooms ?? new InMemoryDiningRoomRepository(),
        },
        {
          provide: OpenShiftReader,
          useValue: dependencies.shifts ?? new ClosedShiftReader(),
        },
        {
          provide: PaidAccountReader,
          useValue: dependencies.paidAccounts ?? new MissingPaidAccountReader(),
        },
        {
          provide: OriginalPaymentReader,
          useValue:
            dependencies.originalPayments ?? new MissingOriginalPaymentReader(),
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
              new ChargeClockAdapter(clock),
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
          provide: PreBillLink,
          useFactory: (secrets: Secrets) =>
            new CloudPreBillLink(
              secrets,
              dependencies.portalPreBillEnabled ?? false,
            ),
          inject: [Secrets],
        },
        {
          provide: RequestCheck,
          useFactory: (
            diningRoom: DiningRoomRepository,
            clock: OrdersClock,
            printer: Printer,
            hub: RealtimeHub,
            preBillLink: PreBillLink,
          ) => new RequestCheck(diningRoom, clock, printer, hub, preBillLink),
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
          useFactory: (
            diningRoom: DiningRoomRepository,
            shifts: OpenShiftReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new ReassignCheck(diningRoom, {
              shifts,
              counts: new CountExecutedOperations(audits),
              permissions: new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              grants: new ConsumeAuthorization(
                authorizations,
                authorizationClock,
              ),
              audits: new RecordAuditEvent(audits, digests, clock),
            }),
          inject: [
            DiningRoomRepository,
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
          provide: Printer,
          useValue: dependencies.printer ?? new InMemoryPrinter(),
        },
        {
          provide: RealtimeHub,
          useValue: realtimeHub,
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
            ordersClock: OrdersClock,
            hub: RealtimeHub,
            shifts: OpenShiftReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
            registerSaleConsumption: RegisterSaleConsumption,
            notRestocked: NotRestockedProductReader,
          ) =>
            new TakeOrder(
              diningRoom,
              menus,
              stations,
              printer,
              ordersClock,
              hub,
              {
                shifts,
                counts: new CountExecutedOperations(audits),
                permissions: new EvaluatePermission(
                  authorizations,
                  sessions,
                  identities,
                  authorizationClock,
                ),
                grants: new ConsumeAuthorization(
                  authorizations,
                  authorizationClock,
                ),
                audits: new RecordAuditEvent(audits, digests, clock),
              },
              {
                saleConsumptionEnabled,
                registerSaleConsumption,
                generationOf: (_tenantId, venueId) =>
                  currentGeneration(dependencies.venueOperations, venueId),
              },
              notRestocked,
            ),
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
            RegisterSaleConsumption,
            NotRestockedProductReader,
          ],
        },
        {
          provide: VoidLine,
          useFactory: (
            diningRoom: DiningRoomRepository,
            shifts: OpenShiftReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
            returnStock: ReturnStock,
            recordWaste: RecordWaste,
          ) =>
            new VoidLine(
              diningRoom,
              shifts,
              new CountExecutedOperations(audits),
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new ConsumeAuthorization(authorizations, authorizationClock),
              new RecordAuditEvent(audits, digests, clock),
              {
                saleConsumptionEnabled,
                returnStock,
                recordWaste,
                generationOf: (_tenantId, venueId) =>
                  currentGeneration(dependencies.venueOperations, venueId),
              },
            ),
          inject: [
            DiningRoomRepository,
            OpenShiftReader,
            AuditRepository,
            AuditDigest,
            Clock,
            AuthorizationRepository,
            SessionReader,
            IdentityReader,
            AuthorizationClock,
            ReturnStock,
            RecordWaste,
          ],
        },
        {
          provide: VoidAccount,
          useFactory: (
            diningRoom: DiningRoomRepository,
            shifts: OpenShiftReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new VoidAccount(
              diningRoom,
              shifts,
              new CountExecutedOperations(audits),
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new ConsumeAuthorization(authorizations, authorizationClock),
              new RecordAuditEvent(audits, digests, clock),
            ),
          inject: [
            DiningRoomRepository,
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
          provide: ApplyDiscount,
          useFactory: (
            diningRoom: DiningRoomRepository,
            shifts: OpenShiftReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new ApplyDiscount(
              diningRoom,
              shifts,
              new CountExecutedOperations(audits),
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new ConsumeAuthorization(authorizations, authorizationClock),
              new RecordAuditEvent(audits, digests, clock),
            ),
          inject: [
            DiningRoomRepository,
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
          provide: ApplyCourtesy,
          useFactory: (
            diningRoom: DiningRoomRepository,
            shifts: OpenShiftReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new ApplyCourtesy(
              diningRoom,
              shifts,
              new CountExecutedOperations(audits),
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new ConsumeAuthorization(authorizations, authorizationClock),
              new RecordAuditEvent(audits, digests, clock),
            ),
          inject: [
            DiningRoomRepository,
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
          provide: ChangePrice,
          useFactory: (
            diningRoom: DiningRoomRepository,
            shifts: OpenShiftReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new ChangePrice(
              diningRoom,
              shifts,
              new CountExecutedOperations(audits),
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new ConsumeAuthorization(authorizations, authorizationClock),
              new RecordAuditEvent(audits, digests, clock),
            ),
          inject: [
            DiningRoomRepository,
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
          provide: OpenDrawer,
          useFactory: (
            organizations: OrganizationRepository,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new OpenDrawer(
              new OrganizationRegisterDirectory(organizations),
              new CountExecutedOperations(audits),
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new ConsumeAuthorization(authorizations, authorizationClock),
              new RecordAuditEvent(audits, digests, clock),
              salePrinter,
            ),
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
        { provide: TipRuleStore, useValue: tipRules },
        {
          provide: ConfigureTipRule,
          useFactory: (
            rules: TipRuleStore,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
          ) =>
            new ConfigureTipRule(
              rules,
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new RecordAuditEvent(audits, digests, clock),
            ),
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
        { provide: TipPool, useValue: tipPool },
        {
          provide: TipParticipantSource,
          useFactory: (
            entries: ClockEntryRepository,
            corrections: ClockEntryCorrectionRepository,
            policies: AttendancePolicyRepository,
          ) => new AttendanceTipParticipants(entries, corrections, policies),
          inject: [
            ClockEntryRepository,
            ClockEntryCorrectionRepository,
            AttendancePolicyRepository,
          ],
        },
        { provide: TipSettlementStore, useValue: tipSettlements },
        {
          provide: SettleTips,
          useFactory: (
            rules: TipRuleStore,
            pool: TipPool,
            participants: TipParticipantSource,
            settlements: TipSettlementStore,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
          ) =>
            new SettleTips(
              rules,
              pool,
              participants,
              settlements,
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new RecordAuditEvent(audits, digests, clock),
            ),
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
          useFactory: (
            rules: TipRuleStore,
            settlements: TipSettlementStore,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
          ) =>
            new AdjustTipSettlement(
              rules,
              settlements,
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new RecordAuditEvent(audits, digests, clock),
            ),
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
        { provide: PrintJobRepository, useValue: tipPrintJobs },
        { provide: PrinterRepository, useValue: tipPrinters },
        { provide: DispatchJobRepository, useValue: tipDispatchJobs },
        { provide: DispatchPrinterRepository, useValue: tipDispatchPrinters },
        {
          provide: EnqueuePrintJob,
          useFactory: (printers: PrinterRepository, jobs: PrintJobRepository) =>
            new EnqueuePrintJob(printers, jobs),
          inject: [PrinterRepository, PrintJobRepository],
        },
        {
          provide: DispatchPrintJobs,
          useFactory: (
            jobs: DispatchJobRepository,
            printers: DispatchPrinterRepository,
          ) => new DispatchPrintJobs(jobs, printers, tipPrintTransport),
          inject: [DispatchJobRepository, DispatchPrinterRepository],
        },
        {
          provide: PrintTipSettlement,
          useFactory: (
            settlements: TipSettlementStore,
            enqueue: EnqueuePrintJob,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new PrintTipSettlement(
              settlements,
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new TipSettlementQueue(enqueue),
            ),
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
          useFactory: (
            accounts: PaidAccountReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new ReopenPaidAccount(
              accounts,
              registers,
              new CountExecutedOperations(audits),
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new ConsumeAuthorization(authorizations, authorizationClock),
              new RecordAuditEvent(audits, digests, clock),
            ),
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
          useFactory: (
            payments: OriginalPaymentReader,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new ChangeTender(
              payments,
              registers,
              new CountExecutedOperations(audits),
              new EvaluatePermission(
                authorizations,
                sessions,
                identities,
                authorizationClock,
              ),
              new ConsumeAuthorization(authorizations, authorizationClock),
              new RecordAuditEvent(audits, digests, clock),
            ),
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
          useValue: ordersVenues,
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
        { provide: "OneTimeCodeSender", useValue: oneTimeCodeSender },
        {
          provide: LookUpPortalBuyer,
          useFactory: (provider: InvoicingProvider) =>
            new LookUpPortalBuyer(
              portalBuyerStore,
              portalLookupLimiter,
              provider,
            ),
          inject: [InvoicingProvider],
        },
        { provide: MemoryReinvoiceRequests, useValue: reinvoiceRequests },
        {
          provide: RequestReinvoice,
          useFactory: (provider: InvoicingProvider) =>
            new RequestReinvoice(
              reinvoiceRequests as unknown as ConstructorParameters<
                typeof RequestReinvoice
              >[0],
              provider,
            ),
          inject: [InvoicingProvider],
        },
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
        {
          provide: ApproveReinvoice,
          useFactory: (notes: IssueCreditNote) =>
            new ApproveReinvoice(
              reinvoiceRequests,
              notes,
              new IssueDocument(
                new HoldingQueuedClosures(),
                new MemorySalesDocuments(),
                invoicingProvider as unknown as InvoicingProvider<DocumentIssuance>,
              ),
            ),
          inject: [IssueCreditNote],
        },
        { provide: NumberingRangeStore, useValue: numberingRanges },
        { provide: ReprintCap, useValue: reprintCap },
        { provide: MemoryReprintAudit, useValue: reprintAudits },
        { provide: StructurePrinters, useValue: structurePrinters },
        {
          provide: EvaluatePermission,
          useFactory: (
            authorizations: AuthorizationRepository,
            sessions: SessionReader,
            identities: IdentityReader,
            authorizationClock: AuthorizationClock,
          ) =>
            new EvaluatePermission(
              authorizations,
              sessions,
              identities,
              authorizationClock,
            ),
          inject: [
            AuthorizationRepository,
            SessionReader,
            IdentityReader,
            AuthorizationClock,
          ],
        },
        {
          provide: ReadControlReport,
          useFactory: (
            audits: AuditRepository,
            permissions: EvaluatePermission,
          ) => new ReadControlReport(audits, permissions),
          inject: [AuditRepository, EvaluatePermission],
        },
        {
          provide: ReportingFacts,
          useFactory: (
            diningRoom: DiningRoomRepository,
            entries: ClockEntryRepository,
            corrections: ClockEntryCorrectionRepository,
            policies: AttendancePolicyRepository,
          ) =>
            createReportingFacts(
              diningRoom,
              entries,
              corrections,
              policies,
              new MemoryLedgerCashFacts({
                listCharges: (tenantId, venueId) =>
                  charges.list(tenantId, venueId),
                listSettlements: async (tenantId, venueId) =>
                  (await tipSettlements.list(tenantId, venueId)).map((row) => ({
                    id: row.id,
                    poolCop: row.poolCop,
                  })),
                listCounts: (tenantId, venueId) =>
                  counts.list(tenantId, venueId),
              }),
            ),
          inject: [
            DiningRoomRepository,
            ClockEntryRepository,
            ClockEntryCorrectionRepository,
            AttendancePolicyRepository,
          ],
        },
        {
          provide: PermissionReportAccess,
          useFactory: (
            authorizations: AuthorizationRepository,
            authorizationClock: AuthorizationClock,
          ) => new PermissionReportAccess(authorizations, authorizationClock),
          inject: [AuthorizationRepository, AuthorizationClock],
        },
        {
          provide: VenueOpenShift,
          useFactory: () => new VenueOpenShift(registers),
        },
        {
          provide: ReadSalesReport,
          useFactory: (
            access: PermissionReportAccess,
            shifts: VenueOpenShift,
            facts: ReportingFacts,
          ) => new ReadSalesReport(access, shifts, facts),
          inject: [PermissionReportAccess, VenueOpenShift, ReportingFacts],
        },
        {
          provide: ReadTimeReport,
          useFactory: (
            access: PermissionReportAccess,
            shifts: VenueOpenShift,
            facts: ReportingFacts,
          ) => new ReadTimeReport(access, shifts, facts),
          inject: [PermissionReportAccess, VenueOpenShift, ReportingFacts],
        },
        {
          provide: ReadCashReport,
          useFactory: (
            access: PermissionReportAccess,
            shifts: VenueOpenShift,
            facts: ReportingFacts,
          ) => new ReadCashReport(access, shifts, facts),
          inject: [PermissionReportAccess, VenueOpenShift, ReportingFacts],
        },
        {
          provide: ReadStaffReport,
          useFactory: (
            access: PermissionReportAccess,
            shifts: VenueOpenShift,
            facts: ReportingFacts,
          ) => new ReadStaffReport(access, shifts, facts),
          inject: [PermissionReportAccess, VenueOpenShift, ReportingFacts],
        },
        {
          provide: DetectUnusualBehavior,
          useFactory: (audits: AuditRepository) =>
            new DetectUnusualBehavior(audits),
          inject: [AuditRepository],
        },
        {
          provide: RecipeCatalogRepository,
          useValue: projectingCatalogs,
        },
        {
          provide: RecipeWorkbook,
          useValue: dependencies.recipeWorkbook ?? new ExcelRecipeWorkbook(),
        },
        {
          provide: SitePrice,
          useFactory: (
            menus: MenuRepository,
            venues: VenueDirectory,
            clock: OrdersClock,
          ) => new MenuSitePrice(menus, venues, clock),
          inject: [MenuRepository, VenueDirectory, OrdersClock],
        },
        {
          provide: RecipeVenueDirectory,
          useValue: recipeVenues,
        },
        {
          provide: StockLedgerRepository,
          useFactory: () => stock.ledger,
        },
        {
          provide: PointOfSaleDirectory,
          useFactory: () => stock.pointsOfSale,
        },
        {
          provide: StockMovementQueue,
          useFactory: () => stock.movements,
        },
        {
          provide: OperationGeneration,
          useFactory: (operations: VenueOperationRepository) =>
            new VenueOperationGeneration(operations),
          inject: [VenueOperationRepository],
        },
        {
          provide: StockAlertPublisher,
          useFactory: () => new StoredStockAlertPublisher(),
        },
        {
          provide: RecipeVersionReader,
          useFactory: (catalogs: RecipeCatalogRepository) =>
            new CatalogRecipeVersionReader(catalogs),
          inject: [RecipeCatalogRepository],
        },
        {
          provide: ReferenceCostList,
          useFactory: (
            catalogs: RecipeCatalogRepository,
            organizations: OrganizationRepository,
          ) => new CatalogReferenceCostList(catalogs, organizations),
          inject: [RecipeCatalogRepository, OrganizationRepository],
        },
        {
          provide: ExplodeRecipe,
          useFactory: () => {
            if (explodeRecipe === undefined) {
              throw new Error("The recipe explosion is not ready.");
            }

            return explodeRecipe;
          },
        },
        {
          provide: RegisterSaleConsumption,
          useFactory: (
            recipes: ExplodeRecipe,
            versions: RecipeVersionReader,
            costs: ReferenceCostList,
            venues: RecipeVenueDirectory,
            pointsOfSale: PointOfSaleDirectory,
            generations: OperationGeneration,
            ledger: StockLedgerRepository,
            alerts: StockAlertPublisher,
            queue: StockMovementQueue,
          ) =>
            new ProjectingSaleConsumption(
              recipes,
              versions,
              costs,
              venues,
              pointsOfSale,
              generations,
              ledger,
              alerts,
              queue,
              projectProducible,
            ),
          inject: [
            ExplodeRecipe,
            RecipeVersionReader,
            ReferenceCostList,
            RecipeVenueDirectory,
            PointOfSaleDirectory,
            OperationGeneration,
            StockLedgerRepository,
            StockAlertPublisher,
            StockMovementQueue,
          ],
        },
        {
          provide: ReturnStock,
          useFactory: (
            generations: OperationGeneration,
            ledger: StockLedgerRepository,
            queue: StockMovementQueue,
          ) =>
            new ProjectingReturnStock(
              generations,
              ledger,
              queue,
              projectProducible,
            ),
          inject: [
            OperationGeneration,
            StockLedgerRepository,
            StockMovementQueue,
          ],
        },
        {
          provide: RecordWaste,
          useFactory: (
            generations: OperationGeneration,
            ledger: StockLedgerRepository,
            queue: StockMovementQueue,
            audits: AuditRepository,
            digests: AuditDigest,
            clock: Clock,
          ) =>
            new ProjectingRecordWaste(
              generations,
              ledger,
              queue,
              new RecordAuditEvent(audits, digests, clock),
              projectProducible,
            ),
          inject: [
            OperationGeneration,
            StockLedgerRepository,
            StockMovementQueue,
            AuditRepository,
            AuditDigest,
            Clock,
          ],
        },
        {
          provide: QrTableAccess,
          useClass: ClosedQrTableAccess,
        },
        {
          provide: PaymentGateway,
          useFactory: (secrets: Secrets) => qrGatewayFor(secrets),
          inject: [Secrets],
        },
        {
          provide: StartQrPayment,
          useFactory: (
            accounts: OrdersAccount,
            clock: Clock,
            gateway: PaymentGateway,
          ) => startQrPaymentFor(accounts, clock, qrPayments, gateway),
          inject: [OrdersAccount, Clock, PaymentGateway],
        },
        {
          provide: ConfirmQrPayment,
          useFactory: (gateway: PaymentGateway) =>
            confirmQrPaymentFor(qrPayments, gateway),
          inject: [PaymentGateway],
        },
        {
          provide: ApplyQrPayment,
          useFactory: (accounts: OrdersAccount) =>
            applyQrPaymentFor(qrPayments, registers, accounts),
          inject: [OrdersAccount],
        },
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
  recordedAt: string;
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

  async list(tenantId: string, venueId: string) {
    const prefix = `${tenantId}\u0000${venueId}\u0000`;

    return [...this.charges.entries()].flatMap(([key, charge]) => {
      if (!key.startsWith(prefix)) {
        return [];
      }

      return [
        {
          checkId: charge.closure.checkId,
          registerId: charge.closure.registerId,
          tenders: charge.closure.tenders.map((tender) => ({
            method: tender.method,
            amountCop: tender.amountCop,
          })),
          tip: {
            method: charge.closure.tip.method,
            amountCop: charge.closure.tip.amountCop,
          },
          recordedAt: charge.recordedAt,
        },
      ];
    });
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

  async list(tenantId: string, venueId: string) {
    const prefix = `${tenantId}\u0000${venueId}\u0000`;

    return [...this.counts.entries()].flatMap(([key, count]) => {
      if (!key.startsWith(prefix)) {
        return [];
      }

      const reading = count as {
        expectedCashCop?: unknown;
        countedCashCop?: unknown;
      };
      const expectedCop =
        typeof reading.expectedCashCop === "number"
          ? reading.expectedCashCop
          : null;
      const countedCop =
        typeof reading.countedCashCop === "number"
          ? reading.countedCashCop
          : null;

      return [
        {
          registerId: key.slice(prefix.length),
          expectedCop,
          countedCop,
        },
      ];
    });
  }
}

const tipRuleKey = (tenantId: string, venueId: string): string =>
  `${tenantId}\u0000${venueId}`;

const copyTipRule = (rule: ActiveTipRule): ActiveTipRule => ({
  period: rule.period,
  mode: rule.mode,
  shares: rule.shares.map((share) => ({
    employeeId: share.employeeId,
    percent: share.percent,
  })),
});

const copyValue = <T>(value: T): T => structuredClone(value);

export class MemoryTipPool extends TipPool {
  private readonly rows: RecordedPaymentTip[] = [];

  record(payment: RecordedPaymentTip): void {
    this.rows.push(copyValue(payment));
  }

  override list(_query: TipPoolQuery): Promise<readonly RecordedPaymentTip[]> {
    return Promise.resolve(this.rows.map((row) => copyValue(row)));
  }
}

export class MemoryTipSettlements extends TipSettlementStore {
  private readonly rows = new Map<string, ClosedTipSettlement[]>();

  override list(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClosedTipSettlement[]> {
    const stored = this.rows.get(tipRuleKey(tenantId, venueId)) ?? [];

    return Promise.resolve(stored.map((row) => copyValue(row)));
  }

  override append(
    tenantId: string,
    venueId: string,
    settlement: ClosedTipSettlement,
  ): Promise<void> {
    const key = tipRuleKey(tenantId, venueId);
    const stored = this.rows.get(key) ?? [];
    stored.push(copyValue(settlement));
    this.rows.set(key, stored);

    return Promise.resolve();
  }
}

export class MemoryTipRules extends TipRuleStore {
  private readonly rules = new Map<string, ActiveTipRule>();

  override find(
    tenantId: string,
    venueId: string,
  ): Promise<ActiveTipRule | null> {
    const found = this.rules.get(tipRuleKey(tenantId, venueId));

    return Promise.resolve(found === undefined ? null : copyTipRule(found));
  }

  override save(
    tenantId: string,
    venueId: string,
    rule: ActiveTipRule,
  ): Promise<void> {
    this.rules.set(tipRuleKey(tenantId, venueId), copyTipRule(rule));

    return Promise.resolve();
  }
}

interface StoredTipPrinter extends ConfiguredPrinter {
  retryLimit: number;
  backupPrinterId: string | null;
}

type StoredTipPrintJob = Omit<PrintJob, "status"> & {
  status: "waiting" | "printed" | "failed";
  deliveredPrinterId: string | null;
};

const pesos = (amount: number): string => String(amount);

class TipSettlementQueue extends SaleReceiptPrinter {
  constructor(private readonly printJobs: EnqueuePrintJob) {
    super();
  }

  override async enqueue(job: SaleReceiptJob): Promise<QueuedSaleReceipt> {
    if (job.document !== "tips_settlement") {
      throw new Error("Tip settlement printing accepts tips_settlement only.");
    }

    const saved = await this.printJobs.execute({
      commandId: job.commandId,
      printerId: job.printerId,
      kickDrawer: job.kickDrawer,
      document: "tips_settlement",
      period: job.period,
      methods: job.methods.map((method) => ({
        method: method.method,
        amount: pesos(method.amountCop),
      })),
      rule: job.rule,
      residue: pesos(job.residueCop),
      lines: job.shares.map((share) => ({
        participant: share.userId,
        amount: pesos(share.amountCop),
      })),
      total: pesos(job.poolCop),
    });

    return { status: "waiting", kickDrawer: saved.kickDrawer };
  }
}

export class MemoryTipPrintJobs extends PrintJobRepository {
  readonly rows: StoredTipPrintJob[] = [];

  override findByCommand(commandId: string): Promise<PrintJob | null> {
    const found = this.rows.find((row) => row.commandId === commandId);

    if (found === undefined) {
      return Promise.resolve(null);
    }

    return Promise.resolve({ ...found, status: "waiting" });
  }

  override insert(job: PrintJob): Promise<void> {
    this.rows.push({ ...job, deliveredPrinterId: null });

    return Promise.resolve();
  }
}

export class MemoryTipDispatchJobs extends DispatchJobRepository {
  constructor(private readonly jobs: MemoryTipPrintJobs) {
    super();
  }

  override listWaiting(): Promise<DispatchablePrintJob[]> {
    return Promise.resolve(
      this.jobs.rows
        .filter((row) => row.status === "waiting")
        .map((row) => ({
          id: row.id,
          printerId: row.printerId,
          status: row.status,
          text: row.text,
          deliveredPrinterId: row.deliveredPrinterId,
        })),
    );
  }

  override save(job: DispatchablePrintJob): Promise<void> {
    const found = this.jobs.rows.find((row) => row.id === job.id);

    if (found !== undefined) {
      found.status = job.status;
      found.deliveredPrinterId = job.deliveredPrinterId;
    }

    return Promise.resolve();
  }
}

export class MemoryTipPrinters extends PrinterRepository {
  readonly configured = new Map<string, StoredTipPrinter>();

  override save(printer: ConfiguredPrinter): Promise<void> {
    const current = this.configured.get(printer.id);

    this.configured.set(printer.id, {
      id: printer.id,
      paper: printer.paper,
      retryLimit: current?.retryLimit ?? 1,
      backupPrinterId: current?.backupPrinterId ?? null,
    });

    return Promise.resolve();
  }

  override find(id: string): Promise<ConfiguredPrinter | null> {
    const found = this.configured.get(id);

    if (found === undefined) {
      return Promise.resolve(null);
    }

    return Promise.resolve({ id: found.id, paper: found.paper });
  }
}

export class MemoryTipDispatchPrinters extends DispatchPrinterRepository {
  constructor(private readonly printers: MemoryTipPrinters) {
    super();
  }

  override find(id: string): Promise<DispatchPrinter | null> {
    const found = this.printers.configured.get(id);

    if (found === undefined) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      id: found.id,
      retryLimit: found.retryLimit,
      backupPrinterId: found.backupPrinterId,
    });
  }
}

class MemoryTipPrintTransport extends PrintTransport {
  override send(_delivery: PrintDelivery): Promise<void> {
    return Promise.resolve();
  }
}

class ConfiguredOneTimeCodeSender {
  send(): Promise<void> {
    return Promise.resolve();
  }
}

class UnconfiguredOneTimeCodeSender {
  constructor() {
    throw new Error("OneTimeCodeSender is not configured.");
  }

  send(): Promise<void> {
    return Promise.reject(new Error("OneTimeCodeSender is not configured."));
  }
}

class AllowingPortalLookupLimiter {
  acquire(_taxId: string, _at: string, _ceiling: number): Promise<void> {
    return Promise.resolve();
  }
}

class RefusingPortalLookupLimiter {
  acquire(_taxId: string, _at: string, _ceiling: number): Promise<void> {
    return Promise.reject(new Error("limited"));
  }
}

export class MemoryPortalBuyerStore {
  readonly lookups: Array<{
    lookupId: string;
    companyId: string;
    documentType: string;
    documentNumber: string;
    name: string;
    email: string;
  }> = [];

  readCache(): Promise<null> {
    return Promise.resolve(null);
  }

  saveCache(_row: {
    companyId: string;
    documentType: string;
    documentNumber: string;
    name: string;
    email: string;
    cachedAt: string;
  }): Promise<void> {
    return Promise.resolve();
  }

  saveLookup(row: {
    lookupId: string;
    companyId: string;
    documentType: string;
    documentNumber: string;
    name: string;
    email: string;
  }): Promise<void> {
    this.lookups.push({ ...row });
    return Promise.resolve();
  }
}

export class MemoryReinvoiceRequests {
  readonly rows: Array<{
    companyId: string;
    invoiceNumber: string;
    issuedAt: string;
    requestedAt: string;
    status: "pending" | "approved";
  }> = [];

  find(
    companyId: string,
    invoiceNumber: string,
  ): Promise<{
    companyId: string;
    invoiceNumber: string;
    issuedAt: string;
    requestedAt: string;
    status: "pending" | "approved";
  } | null> {
    return Promise.resolve(
      this.rows.find(
        (row) =>
          row.companyId === companyId && row.invoiceNumber === invoiceNumber,
      ) ?? null,
    );
  }

  save(row: {
    companyId: string;
    invoiceNumber: string;
    issuedAt: string;
    requestedAt: string;
    status: "pending" | "approved";
  }): Promise<void> {
    const index = this.rows.findIndex(
      (stored) =>
        stored.companyId === row.companyId &&
        stored.invoiceNumber === row.invoiceNumber,
    );

    if (index === -1) {
      this.rows.push({ ...row });
    } else {
      this.rows[index] = { ...row };
    }

    return Promise.resolve();
  }
}

class HoldingQueuedClosures extends QueuedClosureReader {
  override read(closureId: string) {
    return Promise.resolve({
      id: closureId,
      status: "queued" as const,
      saleCop: 0,
      tipCop: 0,
      lines: [],
      payments: [],
    });
  }
}

class MemorySalesDocuments extends SalesDocumentRepository {
  override findByClosureId() {
    return Promise.resolve(null);
  }

  override insert() {
    return Promise.resolve();
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

type NoRestockSql = {
  exec(statement: string): Promise<unknown>;
  query<Row extends Record<string, unknown>>(
    statement: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
};

type NoRestockDatabase = {
  transaction<T>(work: (tx: NoRestockSql) => Promise<T>): Promise<T>;
};

interface NoRestockRow extends Record<string, unknown> {
  tenant_id: string;
  venue_id: string;
  product_id: string;
  status: string;
  actor_id: string | null;
  service_date: string | null;
}

interface GuestToldKey {
  tenantId: string;
  venueId: string;
  checkId: string;
  lineId: string;
}

interface GuestToldRow {
  checkId: string;
  lineId: string;
  actorId: string;
}

const UNCOVERED_PORTIONS = {
  pointPortions: 0,
  supplyingWarehousePortions: 0,
  inboundTransfers: [],
} as const;

const instantOnServiceDate = (serviceDate: string): Date =>
  new Date(`${serviceDate}T17:00:00.000Z`);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const restoreNoRestock = (row: NoRestockRow): NoRestockToday => {
  const mark = NoRestockToday.propose({
    tenantId: row.tenant_id,
    venueId: row.venue_id,
    productId: row.product_id,
    coverage: UNCOVERED_PORTIONS,
  });

  if (mark === null) {
    throw new Error("A stored not-restocked mark could not be restored.");
  }

  if (row.status === "proposed") {
    return mark;
  }

  if (row.actor_id === null || row.service_date === null) {
    throw new Error("A confirmed not-restocked mark is missing its stamp.");
  }

  mark.confirm({
    actorId: row.actor_id,
    at: instantOnServiceDate(row.service_date),
  });

  if (row.status === "removed") {
    mark.remove({ actorId: row.actor_id });
  }

  return mark;
};

const snapshotNoRestock = (
  mark: NoRestockToday,
): {
  status: string;
  actorId: string | null;
  serviceDate: string | null;
} => {
  if (mark.serviceDate === null) {
    return { status: "proposed", actorId: null, serviceDate: null };
  }

  const status = mark.statusAt(instantOnServiceDate(mark.serviceDate));

  return {
    status,
    actorId: mark.actorId,
    serviceDate: mark.serviceDate,
  };
};

class PostgresNoRestockMarks extends NoRestockCatalog {
  constructor(private readonly client: NoRestockDatabase) {
    super();
  }

  override async list(
    tenantId: string,
    venueId: string,
    at: Date,
  ): Promise<
    readonly {
      productId: string;
      status: string;
      serviceDate: string | null;
      actorId: string | null;
    }[]
  > {
    const rows = await this.inTenant(tenantId, (tx) =>
      tx.query<NoRestockRow>(
        `SELECT tenant_id, venue_id, product_id, status, actor_id, service_date
         FROM no_restock_today
         WHERE tenant_id = $1 AND venue_id = $2
         ORDER BY product_id`,
        [tenantId, venueId],
      ),
    );

    return rows.map((row) => {
      const mark = restoreNoRestock(row);

      return {
        productId: mark.productId,
        status: mark.statusAt(at),
        serviceDate: mark.serviceDate,
        actorId: mark.actorId,
      };
    });
  }

  async find(query: {
    tenantId: string;
    venueId: string;
    productId: string;
  }): Promise<NoRestockToday | null> {
    const rows = await this.inTenant(query.tenantId, (tx) =>
      tx.query<NoRestockRow>(
        `SELECT tenant_id, venue_id, product_id, status, actor_id, service_date
         FROM no_restock_today
         WHERE tenant_id = $1 AND venue_id = $2 AND product_id = $3
         LIMIT 1`,
        [query.tenantId, query.venueId, query.productId],
      ),
    );
    const row = rows[0];

    return row === undefined ? null : restoreNoRestock(row);
  }

  async save(mark: NoRestockToday): Promise<void> {
    const stored = snapshotNoRestock(mark);

    await this.inTenant(mark.tenantId, (tx) =>
      tx.query(
        `INSERT INTO no_restock_today (
           tenant_id, venue_id, product_id, status, actor_id, service_date
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, venue_id, product_id)
         DO UPDATE SET
           status = excluded.status,
           actor_id = excluded.actor_id,
           service_date = excluded.service_date`,
        [
          mark.tenantId,
          mark.venueId,
          mark.productId,
          stored.status,
          stored.actorId,
          stored.serviceDate,
        ],
      ),
    );
  }

  private async inTenant<T>(
    tenantId: string,
    work: (tx: NoRestockSql) => Promise<{ rows: T[] }>,
  ): Promise<T[]> {
    return this.client.transaction(async (tx) => {
      await tx.exec("SET LOCAL ROLE inventory_app");
      await tx.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);
      const selected = await work(tx);

      return selected.rows;
    });
  }
}

class NotRestockedProductReader {
  constructor(private readonly marks: PostgresNoRestockMarks | null) {}

  async execute(input: {
    tenantId: string;
    venueId: string;
    productId: string;
    at: Date;
  }): Promise<boolean> {
    if (this.marks === null) {
      return false;
    }

    const mark = await this.marks.find(input);

    return mark !== null && mark.statusAt(input.at) === "confirmed";
  }
}

class MemoryGuestTold {
  private readonly rows = new Map<string, GuestToldRow>();

  async find(query: GuestToldKey): Promise<GuestToldRow | null> {
    return this.rows.get(this.key(query)) ?? null;
  }

  async save(record: GuestToldKey & GuestToldRow): Promise<void> {
    this.rows.set(this.key(record), {
      checkId: record.checkId,
      lineId: record.lineId,
      actorId: record.actorId,
    });
  }

  private key(query: GuestToldKey): string {
    return `${query.tenantId}\u0000${query.venueId}\u0000${query.checkId}\u0000${query.lineId}`;
  }
}

type RecordAuditCommand = Parameters<RecordAuditEvent["execute"]>[0];

class DeferredConfirmAudit extends RecordAuditEvent {
  private held: RecordAuditCommand | null = null;

  override async execute(command: RecordAuditCommand): Promise<AuditEvent> {
    if (command.action !== "inventory.confirm-no-restock") {
      return super.execute(command);
    }

    this.held = command;

    return {
      tenantId: command.tenantId,
      actorId: command.actorId,
      authorizerId: command.authorizerId,
      deviceId: command.deviceId,
      siteId: command.siteId,
      action: command.action,
      entity: command.entity,
      before: command.before,
      after: command.after,
      reason: command.reason,
      occurredAt: 0,
      sequence: 0,
      previousHash: "",
      digest: "",
      kind: "event",
    };
  }

  async flush(tables: readonly string[]): Promise<void> {
    const command = this.held;

    if (command === null) {
      return;
    }

    this.held = null;
    const after = isRecord(command.after) ? { ...command.after } : {};
    after.tables = [...tables];
    await super.execute({ ...command, after });
  }
}

class CloudConfirmNoRestockFlow extends ConfirmNoRestockFlow {
  constructor(
    private readonly marks: PostgresNoRestockMarks,
    private readonly permissions: EvaluatePermission,
    private readonly audits: AuditRepository,
    private readonly digests: AuditDigest,
    private readonly clock: Clock,
    private readonly dining: DiningRoomRepository,
    private readonly hub: RealtimeHub,
  ) {
    super();
  }

  override async execute(
    input: Parameters<ConfirmNoRestockFlow["execute"]>[0],
  ): Promise<Awaited<ReturnType<ConfirmNoRestockFlow["execute"]>>> {
    const deferred = new DeferredConfirmAudit(
      this.audits,
      this.digests,
      this.clock,
    );
    const confirmed = await new ConfirmNoRestockToday(
      this.marks,
      this.permissions,
      deferred,
      true,
    ).execute(input);
    const withdrawn = await new WithdrawUnstartedLines(
      this.dining,
      this.hub,
    ).execute({
      tenantId: input.tenantId,
      venueId: input.venueId,
      productId: input.productId,
      uncoveredPortions: Number.MAX_SAFE_INTEGER,
      at: input.at,
    });
    const tables = [
      ...new Set(withdrawn.withdrawn.map((item) => item.tableId)),
    ];
    await deferred.flush(tables);

    return {
      productId: confirmed.mark.productId,
      status: confirmed.mark.statusAt(input.at),
      serviceDate: confirmed.mark.serviceDate,
      tables,
    };
  }
}

const isMissingPointOfSale = (error: unknown): boolean =>
  error instanceof Error &&
  error.message === "The venue has no point-of-sale location.";

class EmptySupplyingLocations extends SupplyingLocations {
  override async locationIds(): Promise<readonly string[]> {
    return [];
  }
}

const emptySupplyingLocations = new EmptySupplyingLocations();

class MenuLowUnitsThreshold extends LowUnitsThreshold {
  constructor(
    private readonly menus: MenuRepository,
    private readonly venues: VenueDirectory,
  ) {
    super();
  }

  override async thresholdOf(
    tenantId: string,
    siteId: string,
    productId: string,
  ): Promise<number | null> {
    const brandId = await this.venues.brandOf(tenantId, siteId);

    if (brandId === null) {
      return null;
    }

    const menu = await this.menus.load(tenantId, brandId);
    const price = menu?.venuePrices.find(
      (entry) => entry.venueId === siteId && entry.itemId === productId,
    );

    return price?.lowUnitsThreshold ?? null;
  }
}

class MenuAvailabilityPublisher extends AvailabilityPublisher {
  constructor(
    private readonly tenantId: string,
    private readonly apply: ApplyMenuAvailability,
  ) {
    super();
  }

  override async publish(notice: AvailabilityChanged): Promise<void> {
    await this.apply.execute({
      tenantId: this.tenantId,
      venueId: notice.siteId,
      productId: notice.productId,
      variantId: notice.variantId,
      state: notice.state,
    });
  }
}

class ProjectingRecipeCatalog extends RecipeCatalogRepository {
  constructor(
    private readonly inner: RecipeCatalogRepository,
    private readonly after: (publication: RecipePublication) => Promise<void>,
  ) {
    super();
  }

  override load(tenantId: string, brandId: string) {
    return this.inner.load(tenantId, brandId);
  }

  override listPublications(tenantId: string, brandId: string) {
    return this.inner.listPublications(tenantId, brandId);
  }

  override async save(
    ...args: Parameters<RecipeCatalogRepository["save"]>
  ): Promise<void> {
    await this.inner.save(...args);
    const publication = args[1];

    if (publication !== undefined) {
      await this.after(publication);
    }
  }
}

class ProjectingSaleConsumption extends RegisterSaleConsumption {
  constructor(
    recipes: ExplodeRecipe,
    versions: RecipeVersionReader,
    costs: ReferenceCostList,
    venues: RecipeVenueDirectory,
    pointsOfSale: PointOfSaleDirectory,
    generations: OperationGeneration,
    ledger: StockLedgerRepository,
    alerts: StockAlertPublisher,
    queue: StockMovementQueue,
    private readonly project: (tenantId: string) => ProjectProducibleQuantity,
  ) {
    super(
      recipes,
      versions,
      costs,
      venues,
      pointsOfSale,
      generations,
      ledger,
      alerts,
      queue,
    );
    this.movedLedger = ledger;
  }

  private readonly movedLedger: StockLedgerRepository;

  override async execute(
    input: Parameters<RegisterSaleConsumption["execute"]>[0],
  ) {
    const result = await super.execute(input);

    if (!result.missingRecipe) {
      await projectMovedStock(
        this.movedLedger,
        this.project,
        input.tenantId,
        input.venueId,
        input.orderLineId,
        CONSUMPTION_ROLE.CONSUMPTION,
      );
    }

    return result;
  }
}

class ProjectingReturnStock extends ReturnStock {
  constructor(
    generations: OperationGeneration,
    ledger: StockLedgerRepository,
    queue: StockMovementQueue,
    private readonly project: (tenantId: string) => ProjectProducibleQuantity,
  ) {
    super(generations, ledger, queue);
    this.movedLedger = ledger;
  }

  private readonly movedLedger: StockLedgerRepository;

  override async execute(input: Parameters<ReturnStock["execute"]>[0]) {
    const result = await super.execute(input);
    await projectMovedStock(
      this.movedLedger,
      this.project,
      input.tenantId,
      input.venueId,
      input.orderLineId,
      CONSUMPTION_ROLE.REVERSAL,
    );

    return result;
  }
}

class ProjectingRecordWaste extends RecordWaste {
  constructor(
    generations: OperationGeneration,
    ledger: StockLedgerRepository,
    queue: StockMovementQueue,
    audits: RecordAuditEvent,
    private readonly project: (tenantId: string) => ProjectProducibleQuantity,
  ) {
    super(generations, ledger, queue, audits);
    this.movedLedger = ledger;
  }

  private readonly movedLedger: StockLedgerRepository;

  override async execute(input: Parameters<RecordWaste["execute"]>[0]) {
    const result = await super.execute(input);
    await projectMovedStock(
      this.movedLedger,
      this.project,
      input.tenantId,
      input.venueId,
      input.orderLineId,
      CONSUMPTION_ROLE.REVERSAL,
    );

    return result;
  }
}

const projectMovedStock = async (
  ledger: StockLedgerRepository,
  project: (tenantId: string) => ProjectProducibleQuantity,
  tenantId: string,
  venueId: string,
  orderLineId: string,
  role: (typeof CONSUMPTION_ROLE)[keyof typeof CONSUMPTION_ROLE],
): Promise<void> => {
  const lines = await ledger.findLine(tenantId, orderLineId, role);

  for (const line of lines) {
    await project(tenantId).execute({
      kind: "stock",
      tenantId,
      siteId: venueId,
      locationId: line.locationId,
      ingredientId: line.ingredientId,
    });
  }
};
