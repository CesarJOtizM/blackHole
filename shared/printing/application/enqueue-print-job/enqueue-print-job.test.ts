import { expect, it, vi } from "vitest";

import {
  type ConfiguredPrinter,
  EnqueuePrintJob,
  type EnqueuePrintJobCommand,
  PrinterNotConfigured,
  PrinterRepository,
  type PrintJob,
  PrintJobRepository,
  savePrinter,
} from "#application/enqueue-print-job/enqueue-print-job.js";

const connect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("socket opened");
  }),
);

vi.mock("node:net", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    connect,
    createConnection: connect,
  };
});

const PRINTER_ID = "printer_register";
const COMMAND_ID = "command_print_invoice";
const NUMBER = "SETP990000001";
const CUFE = "cufe-100";
const QR =
  "https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=qr-100";

const copyJob = (job: PrintJob): PrintJob => ({
  ...job,
  pulse: job.pulse === null ? null : Uint8Array.from(job.pulse),
});

class MemoryPrinters extends PrinterRepository {
  private readonly printers = new Map<string, ConfiguredPrinter>();

  override async save(printer: ConfiguredPrinter): Promise<void> {
    this.printers.set(printer.id, { ...printer });
  }

  override async find(id: string): Promise<ConfiguredPrinter | null> {
    const printer = this.printers.get(id);

    return printer === undefined ? null : { ...printer };
  }
}

class MemoryPrintJobs extends PrintJobRepository {
  readonly rows: PrintJob[] = [];

  override async findByCommand(commandId: string): Promise<PrintJob | null> {
    const job = this.rows.find((row) => row.commandId === commandId);

    return job === undefined ? null : copyJob(job);
  }

  override async insert(job: PrintJob): Promise<void> {
    this.rows.push(copyJob(job));
  }
}

const harness = () => {
  const printers = new MemoryPrinters();
  const jobs = new MemoryPrintJobs();
  const enqueue = new EnqueuePrintJob(printers, jobs);

  return { printers, jobs, enqueue };
};

const invoice = (
  overrides: {
    commandId?: string;
    printerId?: string;
    kickDrawer?: boolean;
  } = {},
): EnqueuePrintJobCommand => ({
  commandId: COMMAND_ID,
  printerId: PRINTER_ID,
  document: "invoice",
  number: NUMBER,
  cufe: CUFE,
  qr: QR,
  kickDrawer: false,
  ...overrides,
});

it("given a configured printer, when an invoice is enqueued, then the job is stored waiting", async () => {
  const { printers, jobs, enqueue } = harness();
  await savePrinter(printers, { id: PRINTER_ID, paper: "80" });

  const stored = await enqueue.execute(invoice());

  expect(jobs.rows).toHaveLength(1);
  expect(stored.status).toBe("waiting");
  expect(jobs.rows[0]).toEqual(stored);
  expect(stored.text).toContain(NUMBER);
  expect(stored.columns).toBe(48);
});

it("given the same commandId, when the invoice is enqueued again, then a second row is not inserted", async () => {
  const { printers, jobs, enqueue } = harness();
  await savePrinter(printers, { id: PRINTER_ID, paper: "80" });
  const first = await enqueue.execute(invoice({ kickDrawer: true }));

  const retry = await enqueue.execute(invoice({ kickDrawer: false }));

  expect(jobs.rows).toHaveLength(1);
  expect(retry).toEqual(first);
  expect(jobs.rows[0]?.kickDrawer).toBe(true);
});

it("given an unknown printer, when an invoice is enqueued, then PrinterNotConfigured is thrown", async () => {
  const { jobs, enqueue } = harness();

  const pending = enqueue.execute(invoice());

  await expect(pending).rejects.toBeInstanceOf(PrinterNotConfigured);
  expect(jobs.rows).toHaveLength(0);
});

it("given a kick flag, when the invoice is stored, then the job keeps that flag", async () => {
  const { printers, jobs, enqueue } = harness();
  await savePrinter(printers, { id: PRINTER_ID, paper: "58" });

  const stored = await enqueue.execute(invoice({ kickDrawer: true }));

  expect(jobs.rows).toHaveLength(1);
  expect(stored.kickDrawer).toBe(true);
  expect(jobs.rows[0]?.kickDrawer).toBe(true);
  expect(stored.pulse).not.toBeNull();
  expect(stored.columns).toBe(32);
});

it("given a configured printer, when an invoice is enqueued, then no socket is opened", async () => {
  const { printers, jobs, enqueue } = harness();
  await savePrinter(printers, { id: PRINTER_ID, paper: "80" });

  await enqueue.execute(invoice());

  expect(connect).not.toHaveBeenCalled();
  expect(jobs.rows[0]?.status).toBe("waiting");
});
