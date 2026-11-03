import { expect, it, vi } from "vitest";

import {
  type DispatchablePrintJob,
  DispatchJobRepository,
  type DispatchPrinter,
  DispatchPrinterRepository,
  DispatchPrintJobs,
  type PrintDelivery,
  PrintTransport,
} from "#application/dispatch-print-jobs/dispatch-print-jobs.js";

const connect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("socket opened");
  }),
);

const httpFetch = vi.hoisted(() => {
  const fetch = vi.fn(() => {
    throw new Error("http called");
  });

  vi.stubGlobal("fetch", fetch);

  return fetch;
});

vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    connect,
    createConnection: connect,
  };
});

const PRIMARY_ID = "printer_kitchen";
const BACKUP_ID = "printer_kitchen_backup";
const JOB_ID = "print_job_kitchen_ticket";
const TICKET = "Kitchen 4\nTable 2\n1 Soup";
const RETRY_LIMIT = 2;

class MemoryDispatchJobs extends DispatchJobRepository {
  readonly rows: DispatchablePrintJob[] = [];

  override async listWaiting(): Promise<DispatchablePrintJob[]> {
    return this.rows
      .filter((job) => job.status === "waiting")
      .map((job) => ({ ...job }));
  }

  override async save(job: DispatchablePrintJob): Promise<void> {
    const copy = { ...job };
    const index = this.rows.findIndex((row) => row.id === job.id);

    if (index === -1) {
      this.rows.push(copy);
      return;
    }

    this.rows[index] = copy;
  }
}

class MemoryDispatchPrinters extends DispatchPrinterRepository {
  private readonly printers = new Map<string, DispatchPrinter>();

  async save(printer: DispatchPrinter): Promise<void> {
    this.printers.set(printer.id, { ...printer });
  }

  override async find(id: string): Promise<DispatchPrinter | null> {
    const printer = this.printers.get(id);

    return printer === undefined ? null : { ...printer };
  }
}

class MemoryTransport extends PrintTransport {
  readonly attempts: string[] = [];
  readonly sent: PrintDelivery[] = [];
  private readonly failures = new Map<string, number>();

  failTimes(printerId: string, times: number): void {
    this.failures.set(printerId, times);
  }

  override async send(delivery: PrintDelivery): Promise<void> {
    this.attempts.push(delivery.printerId);

    const remaining = this.failures.get(delivery.printerId) ?? 0;

    if (remaining > 0) {
      this.failures.set(delivery.printerId, remaining - 1);
      throw new Error("printer offline");
    }

    this.sent.push({ ...delivery });
  }
}

const harness = (
  printer: { retryLimit?: number; backupPrinterId?: string | null } = {},
) => {
  const jobs = new MemoryDispatchJobs();
  const printers = new MemoryDispatchPrinters();
  const transport = new MemoryTransport();
  const dispatch = new DispatchPrintJobs(jobs, printers, transport);

  return { jobs, printers, transport, dispatch, printer };
};

const seed = async (
  setup: ReturnType<typeof harness>,
  job: DispatchablePrintJob = {
    id: JOB_ID,
    printerId: PRIMARY_ID,
    status: "waiting",
    text: TICKET,
    deliveredPrinterId: null,
  },
) => {
  await setup.printers.save({
    id: PRIMARY_ID,
    retryLimit: setup.printer.retryLimit ?? RETRY_LIMIT,
    backupPrinterId:
      setup.printer.backupPrinterId === undefined
        ? BACKUP_ID
        : setup.printer.backupPrinterId,
  });
  await setup.jobs.save(job);
};

it("given the primary accepts the job inside the retry limit, when it is dispatched, then it prints once and the backup is not used", async () => {
  const setup = harness();
  await seed(setup);
  setup.transport.failTimes(PRIMARY_ID, 1);

  await setup.dispatch.execute();

  expect(setup.transport.attempts).toEqual([PRIMARY_ID, PRIMARY_ID]);
  expect(setup.transport.sent).toEqual([
    { printerId: PRIMARY_ID, jobId: JOB_ID, text: TICKET },
  ]);
  expect(setup.jobs.rows).toHaveLength(1);
  expect(setup.jobs.rows[0]).toEqual({
    id: JOB_ID,
    printerId: PRIMARY_ID,
    status: "printed",
    text: TICKET,
    deliveredPrinterId: PRIMARY_ID,
  });
  expect(setup.jobs.rows[0]).not.toHaveProperty("tenantId");
  expect(connect).not.toHaveBeenCalled();
  expect(httpFetch).not.toHaveBeenCalled();
});

it("given the primary fails for every retry, when the job is dispatched, then the transport sends it to the backup printer", async () => {
  const setup = harness();
  await seed(setup);
  setup.transport.failTimes(PRIMARY_ID, RETRY_LIMIT);

  await setup.dispatch.execute();

  expect(setup.transport.attempts).toEqual([PRIMARY_ID, PRIMARY_ID, BACKUP_ID]);
  expect(setup.transport.sent).toEqual([
    { printerId: BACKUP_ID, jobId: JOB_ID, text: TICKET },
  ]);
  expect(setup.jobs.rows[0]).toEqual({
    id: JOB_ID,
    printerId: PRIMARY_ID,
    status: "printed",
    text: TICKET,
    deliveredPrinterId: BACKUP_ID,
  });
  expect(setup.jobs.rows[0]).not.toHaveProperty("pulse");
  expect(setup.jobs.rows[0]).not.toHaveProperty("tenantId");
  expect(connect).not.toHaveBeenCalled();
  expect(httpFetch).not.toHaveBeenCalled();
});

it("given the primary and the backup both fail, when the job is dispatched, then the job is marked failed", async () => {
  const setup = harness();
  await seed(setup);
  setup.transport.failTimes(PRIMARY_ID, RETRY_LIMIT);
  setup.transport.failTimes(BACKUP_ID, 1);

  await setup.dispatch.execute();

  expect(setup.transport.attempts).toEqual([PRIMARY_ID, PRIMARY_ID, BACKUP_ID]);
  expect(setup.transport.sent).toEqual([]);
  expect(setup.jobs.rows).toHaveLength(1);
  expect(setup.jobs.rows[0]).toEqual({
    id: JOB_ID,
    printerId: PRIMARY_ID,
    status: "failed",
    text: TICKET,
    deliveredPrinterId: null,
  });
  expect(connect).not.toHaveBeenCalled();
  expect(httpFetch).not.toHaveBeenCalled();
});

it("given retries are exhausted and the printer has no backup, when the job is dispatched, then the job is marked failed", async () => {
  const setup = harness({ backupPrinterId: null });
  await seed(setup);
  setup.transport.failTimes(PRIMARY_ID, RETRY_LIMIT);

  await setup.dispatch.execute();

  expect(setup.transport.attempts).toEqual([PRIMARY_ID, PRIMARY_ID]);
  expect(setup.transport.sent).toEqual([]);
  expect(setup.jobs.rows[0]?.status).toBe("failed");
  expect(setup.jobs.rows[0]?.deliveredPrinterId).toBeNull();
});

it("given the printer was never configured, when the job is dispatched, then the job is marked failed and the transport is not called", async () => {
  const jobs = new MemoryDispatchJobs();
  const printers = new MemoryDispatchPrinters();
  const transport = new MemoryTransport();
  const dispatch = new DispatchPrintJobs(jobs, printers, transport);
  await jobs.save({
    id: JOB_ID,
    printerId: PRIMARY_ID,
    status: "waiting",
    text: TICKET,
    deliveredPrinterId: null,
  });

  await dispatch.execute();

  expect(transport.attempts).toEqual([]);
  expect(jobs.rows[0]?.status).toBe("failed");
  expect(jobs.rows[0]?.deliveredPrinterId).toBeNull();
  expect(connect).not.toHaveBeenCalled();
  expect(httpFetch).not.toHaveBeenCalled();
});

it("given a job already dispatched, when dispatch runs again, then the transport does not send it", async () => {
  const setup = harness();
  await seed(setup);

  await setup.dispatch.execute();
  setup.transport.attempts.length = 0;
  setup.transport.sent.length = 0;

  await setup.dispatch.execute();

  expect(setup.transport.attempts).toEqual([]);
  expect(setup.transport.sent).toEqual([]);
  expect(setup.jobs.rows).toHaveLength(1);
  expect(setup.jobs.rows[0]?.status).toBe("printed");
  expect(setup.jobs.rows[0]?.deliveredPrinterId).toBe(PRIMARY_ID);
});
