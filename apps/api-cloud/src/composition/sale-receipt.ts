import { AsyncLocalStorage } from "node:async_hooks";

import {
  DrawerAudit,
  type DrawerOpenedAudit,
  Printer,
  type QueuedSaleReceipt,
  type SaleReceiptJob,
} from "@blackhole/cash-register/application/entry-port";
import { InMemoryPrinter } from "@blackhole/orders/adapters/memory/in-memory-printer";
import type { Printer as OrdersPrinter } from "@blackhole/orders/application/ports/printer";
import { RecordAuditEvent } from "@blackhole/platform/application/entry-port";
import type { AuditDigest } from "@blackhole/platform/application/ports/audit-digest";
import type { AuditRepository } from "@blackhole/platform/application/ports/audit-repository";
import type { Clock } from "@blackhole/platform/application/ports/clock";

export type PendingSaleJob = SaleReceiptJob & {
  status: "waiting";
};

export class PendingSalePrinter extends Printer {
  readonly jobs: PendingSaleJob[] = [];

  override async enqueue(job: SaleReceiptJob): Promise<QueuedSaleReceipt> {
    const queued: PendingSaleJob = { ...job, status: "waiting" };

    this.jobs.push(queued);

    return { status: "waiting", kickDrawer: job.kickDrawer };
  }
}

export const queuedOrderCount = (printer: OrdersPrinter): number =>
  printer instanceof InMemoryPrinter ? printer.jobs.length : 0;

export const orderStayedWaiting = (
  printer: OrdersPrinter,
  before: number,
): boolean =>
  printer instanceof InMemoryPrinter &&
  !printer.fail &&
  printer.jobs.length > before;

interface DrawerAuditScope {
  tenantId: string;
  actorId: string;
  authorizerId: string | null;
  deviceId: string;
  siteId: string;
}

const drawerAuditScopes = new AsyncLocalStorage<DrawerAuditScope>();

export const withDrawerAudit = <T>(
  scope: DrawerAuditScope,
  work: () => Promise<T>,
): Promise<T> => drawerAuditScopes.run(scope, work);

export class DrawerAuditScopeMissing extends Error {
  constructor() {
    super("A drawer audit requires the accepted sale.");
    this.name = "DrawerAuditScopeMissing";
  }
}

export class RecordedDrawerAudit extends DrawerAudit {
  constructor(
    private readonly audits: AuditRepository,
    private readonly digests: AuditDigest,
    private readonly clock: Clock,
  ) {
    super();
  }

  override async record(event: DrawerOpenedAudit): Promise<void> {
    const scope = drawerAuditScopes.getStore();

    if (scope === undefined) {
      throw new DrawerAuditScopeMissing();
    }

    await new RecordAuditEvent(this.audits, this.digests, this.clock).execute({
      tenantId: scope.tenantId,
      actorId: scope.actorId,
      authorizerId: scope.authorizerId,
      deviceId: scope.deviceId,
      siteId: scope.siteId,
      action: event.action,
      entity: event.paymentId,
      before: null,
      after: {
        paymentId: event.paymentId,
        registerId: event.registerId,
        printerId: event.printerId,
      },
      reason: event.action,
    });
  }
}
