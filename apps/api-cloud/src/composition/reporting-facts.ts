import { ListStaffHours } from "@blackhole/attendance/application/entry-port";
import type { AttendancePolicyRepository } from "@blackhole/attendance/application/ports/attendance-policy-repository";
import type { ClockEntryCorrectionRepository } from "@blackhole/attendance/application/ports/clock-entry-correction-repository";
import type { ClockEntryRepository } from "@blackhole/attendance/application/ports/clock-entry-repository";
import {
  type CashFactReader,
  ListCashFacts,
} from "@blackhole/cash-register/application/entry-port";
import {
  IssuedInvoiceReader,
  ListInvoiceFacts,
} from "@blackhole/invoicing/application/entry-port";
import { ListServiceFacts } from "@blackhole/orders/application/entry-port";
import type { DiningRoomRepository } from "@blackhole/orders/application/ports/dining-room-repository";
import type { AuthorizationClock } from "@blackhole/platform/application/ports/authorization-clock";
import type { AuthorizationRepository } from "@blackhole/platform/application/ports/authorization-repository";
import type { Authorization } from "@blackhole/platform/domain";
import type {
  CashCountFact,
  InvoiceFact,
  OperationFacts,
  OperationFactsQuery,
  OperationSnapshot,
  SalesChannel,
  ServiceLineFact,
  StaffHoursFact,
  TenderFact,
} from "@blackhole/reporting/application/ports/operation-facts";
import type {
  OpenShiftBounds,
  ReportAccess,
  ReportAccessQuery,
} from "@blackhole/reporting/application/ports/report-access";

export class ReportReadFailed extends Error {
  constructor() {
    super("Report read failed");
    this.name = "ReportReadFailed";
  }
}

class EmptyIssuedInvoices extends IssuedInvoiceReader {
  list(): Promise<readonly []> {
    return Promise.resolve([]);
  }
}

const emptyPortal = {
  save: (): Promise<void> => Promise.resolve(),
  find: (): Promise<null> => Promise.resolve(null),
};

const reportedChannel = (channel: string): SalesChannel | null =>
  channel === "waiter" || channel === "fixed_point" ? channel : null;

const serviceLine = (
  line: Awaited<ReturnType<ListServiceFacts["execute"]>>[number],
): ServiceLineFact | null => {
  const channel = reportedChannel(line.channel);

  if (channel === null) {
    return null;
  }

  return {
    checkId: line.checkId,
    lineId: line.lineId,
    tableId: null,
    productId: line.lineId,
    productName: line.lineId,
    stationId: line.stationId,
    waiterId: line.waiterId,
    channel,
    quantity: 1,
    grossCop: line.grossCop,
    discountCop: line.discountCop,
    includedTaxCop: line.includedTaxCop ?? 0,
    tipCop: line.tipCop ?? 0,
    voided: line.voided,
    diners: line.diners,
    openedAt: line.openedAt,
    sentAt: line.sentAt,
    inPreparationAt: line.inPreparationAt,
    readyAt: line.readyAt,
    deliveredAt: line.deliveredAt,
    requestedAt: line.requestedAt,
    chargedAt: null,
    releasedAt: line.releasedAt,
  };
};

export class ReportingFacts implements OperationFacts {
  constructor(
    private readonly service: ListServiceFacts,
    private readonly staff: ListStaffHours,
    private readonly invoices: ListInvoiceFacts,
    private readonly cash: ListCashFacts,
  ) {}

  async read(query: OperationFactsQuery): Promise<OperationSnapshot> {
    try {
      const [lines, hours, invoices, cash] = await Promise.all([
        this.service.execute(query),
        this.staff.execute(query),
        this.invoices.execute({
          companyId: query.tenantId,
          from: query.from,
          to: query.to,
        }),
        this.cash.execute(query),
      ]);

      return {
        lines: lines.flatMap((line) => {
          const mapped = serviceLine(line);
          return mapped === null ? [] : [mapped];
        }),
        tenders: cash.tenders.map(
          (row): TenderFact => ({
            checkId: row.checkId,
            waiterId: row.waiterId,
            method: row.method,
            amountCop: row.amountCop,
            tipCop: row.tipCop,
            chargedAt: row.chargedAt,
          }),
        ),
        cashCounts: cash.counts.map(
          (row): CashCountFact => ({
            shiftId: row.shiftId,
            method: row.method,
            expectedCop: row.expectedCop,
            countedCop: row.countedCop,
            closedAt: row.chargedAt,
          }),
        ),
        staffHours: hours.map(
          (row): StaffHoursFact => ({
            waiterId: row.userId,
            workedMinutes: row.workedMinutes,
            latenessMinutes: row.latenessMinutes,
            absent: row.absent,
            corrected: row.corrected,
            at: query.from,
          }),
        ),
        invoices: invoices.map(
          (row): InvoiceFact => ({
            invoiceId: row.invoiceNumber,
            buyer: row.buyer,
            capture: "unspecified",
            reinvoiceCount: row.reinvoiceCount,
            issuedAt: row.issuedAt,
          }),
        ),
      };
    } catch (error: unknown) {
      if (error instanceof ReportReadFailed) {
        throw error;
      }

      throw new ReportReadFailed();
    }
  }
}

export const createReportingFacts = (
  diningRoom: DiningRoomRepository,
  entries: ClockEntryRepository,
  corrections: ClockEntryCorrectionRepository,
  policies: AttendancePolicyRepository,
  cash: CashFactReader,
): ReportingFacts =>
  new ReportingFacts(
    new ListServiceFacts(diningRoom),
    new ListStaffHours(entries, corrections, policies),
    new ListInvoiceFacts(
      new EmptyIssuedInvoices(),
      emptyPortal as ConstructorParameters<typeof ListInvoiceFacts>[1],
    ),
    new ListCashFacts(cash),
  );

export class PermissionReportAccess implements ReportAccess {
  constructor(
    private readonly authorizations: AuthorizationRepository,
    private readonly clock: AuthorizationClock,
  ) {}

  async allows(input: ReportAccessQuery): Promise<boolean> {
    const authorization = await this.authorizations.load(input.tenantId);

    if (!authorization) {
      return false;
    }

    return this.permitted(authorization, input);
  }

  private permitted(
    authorization: Authorization,
    input: ReportAccessQuery,
  ): boolean {
    const decision = authorization.evaluateFor(input.actorId, {
      permission: input.permission,
      at: this.clock.now(),
      target: { kind: "site", id: input.venueId, brandId: null },
      value: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
      selfAuthorizationAttempt: false,
      shiftId: null,
    });

    return decision.outcome === "allowed";
  }
}

export class AbsentOpenShift implements OpenShiftBounds {
  findOpen(): Promise<null> {
    return Promise.resolve(null);
  }
}
