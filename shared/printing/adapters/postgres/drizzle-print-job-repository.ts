import type { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { printers, printJobs } from "#adapters/postgres/schema.js";
import {
  type ConfiguredPrinter,
  PrinterRepository,
  type PrintJob,
  PrintJobRepository,
} from "#application/enqueue-print-job/enqueue-print-job.js";

export const PRINT_JOB_DUPLICATE = "This command is already queued.";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type PrinterRow = typeof printers.$inferSelect;
type PrintJobRow = typeof printJobs.$inferSelect;

const cloneJob = (job: PrintJob): PrintJob => ({
  id: job.id,
  commandId: job.commandId,
  printerId: job.printerId,
  document: job.document,
  paper: job.paper,
  status: job.status,
  kickDrawer: job.kickDrawer,
  columns: job.columns,
  text: job.text,
  pulse: job.pulse === null ? null : Uint8Array.from(job.pulse),
});

const isDuplicateCommand = (error: unknown): boolean => {
  const visited = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const record = current as {
      code?: string;
      message?: string;
      cause?: unknown;
    };
    const message = record.message ?? "";
    const duplicate =
      record.code === "23505" ||
      message.includes("print_jobs_command") ||
      message.includes("print_jobs_pkey");

    if (duplicate) {
      return true;
    }

    current = record.cause;
  }

  return false;
};

const inTenant = async <T>(
  database: Database,
  tenantId: string,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> =>
  database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE printing_app`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );

    return work(tx);
  });

const toPrinter = (row: PrinterRow, tenantId: string): ConfiguredPrinter => {
  if (row.tenantId !== tenantId) {
    throw new Error("Stored printer does not match the tenant.");
  }

  return { id: row.id, paper: row.paper };
};

const toJob = (row: PrintJobRow, tenantId: string): PrintJob => {
  if (row.tenantId !== tenantId) {
    throw new Error("Stored print job does not match the tenant.");
  }

  if (row.status !== "waiting") {
    throw new Error("Stored print job is not waiting.");
  }

  return cloneJob({
    id: row.id,
    commandId: row.commandId,
    printerId: row.printerId,
    document: row.document,
    paper: row.paper,
    status: "waiting",
    kickDrawer: row.kickDrawer,
    columns: row.columns,
    text: row.body,
    pulse: row.pulse === null ? null : Uint8Array.from(row.pulse),
  });
};

export class DrizzlePrinterRepository extends PrinterRepository {
  private readonly database: Database;

  constructor(
    client: PGlite,
    private readonly tenantId: string,
  ) {
    super();
    this.database = drizzle({ client });
  }

  override async save(printer: ConfiguredPrinter): Promise<void> {
    await inTenant(this.database, this.tenantId, async (tx) => {
      await tx.insert(printers).values({
        tenantId: this.tenantId,
        id: printer.id,
        paper: printer.paper,
      });
    });
  }

  override async find(id: string): Promise<ConfiguredPrinter | null> {
    return inTenant(this.database, this.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(printers)
        .where(eq(printers.id, id))
        .limit(1);
      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return toPrinter(row, this.tenantId);
    });
  }
}

export class DrizzlePrintJobRepository extends PrintJobRepository {
  private readonly database: Database;

  constructor(
    client: PGlite,
    private readonly tenantId: string,
  ) {
    super();
    this.database = drizzle({ client });
  }

  override async findByCommand(commandId: string): Promise<PrintJob | null> {
    return inTenant(this.database, this.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(printJobs)
        .where(eq(printJobs.commandId, commandId))
        .limit(1);
      const row = rows[0];

      if (row === undefined) {
        return null;
      }

      return toJob(row, this.tenantId);
    });
  }

  override async insert(job: PrintJob): Promise<void> {
    const copy = cloneJob(job);

    await inTenant(this.database, this.tenantId, async (tx) => {
      const existing = await tx
        .select({ id: printJobs.id })
        .from(printJobs)
        .where(eq(printJobs.commandId, copy.commandId))
        .limit(1);

      if (existing.length > 0) {
        throw new Error(PRINT_JOB_DUPLICATE);
      }

      try {
        await tx.insert(printJobs).values({
          tenantId: this.tenantId,
          id: copy.id,
          commandId: copy.commandId,
          printerId: copy.printerId,
          document: copy.document,
          paper: copy.paper,
          status: copy.status,
          kickDrawer: copy.kickDrawer,
          columns: copy.columns,
          body: copy.text,
          pulse: copy.pulse === null ? null : Array.from(copy.pulse),
        });
      } catch (error: unknown) {
        if (isDuplicateCommand(error)) {
          throw new Error(PRINT_JOB_DUPLICATE);
        }

        throw error;
      }
    });
  }
}
