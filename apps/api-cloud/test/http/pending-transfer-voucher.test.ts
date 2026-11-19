import type { TransferVoucherDraft } from "@blackhole/inventory/application/ports/transfer-voucher";
import {
  type ConfiguredPrinter,
  EnqueuePrintJob,
  PrinterRepository,
  type PrintJob,
  PrintJobRepository,
  savePrinter,
} from "@blackhole/printing/application/entry-port";
import { expect, it } from "vitest";

import {
  bindPendingTransferVoucher,
  PendingTransferVoucher,
} from "#src/http/transfers.controller.js";

const PRINTER_ID = "printer_transfer";
const TRANSFER_ID = "transfer_0112";
const TENANT_ID = "organization_company_1";
const ORIGIN_ID = "organization_warehouse_1";
const DESTINATION_ID = "organization_point_1";
const LINES = [
  { ingredientId: "ingredient_beef", quantity: 1000 },
  { ingredientId: "ingredient_rice", quantity: 250 },
] as const;

class RecordingPrinters extends PrinterRepository {
  private readonly printers = new Map<string, ConfiguredPrinter>();

  override save(printer: ConfiguredPrinter): Promise<void> {
    this.printers.set(printer.id, { ...printer });

    return Promise.resolve();
  }

  override find(id: string): Promise<ConfiguredPrinter | null> {
    const printer = this.printers.get(id);

    return Promise.resolve(printer === undefined ? null : { ...printer });
  }
}

class RecordingPrintJobs extends PrintJobRepository {
  readonly rows: PrintJob[] = [];

  override findByCommand(commandId: string): Promise<PrintJob | null> {
    const found = this.rows.find((row) => row.commandId === commandId);

    return Promise.resolve(found === undefined ? null : { ...found });
  }

  override insert(job: PrintJob): Promise<void> {
    this.rows.push({ ...job });

    return Promise.resolve();
  }
}

it("given a dispatched transfer voucher, when print runs twice with a bound printer, then one job is queued with that transfer id and those lines", async () => {
  const printers = new RecordingPrinters();
  const jobs = new RecordingPrintJobs();
  const printJobs = new EnqueuePrintJob(printers, jobs);
  await savePrinter(printers, { id: PRINTER_ID, paper: "80" });
  bindPendingTransferVoucher(printJobs, PRINTER_ID);
  const voucher = new PendingTransferVoucher();
  const draft: TransferVoucherDraft = {
    document: "transfer",
    tenantId: TENANT_ID,
    transferId: TRANSFER_ID,
    originLocationId: ORIGIN_ID,
    destinationLocationId: DESTINATION_ID,
    lines: LINES,
  };

  await voucher.print(draft);
  await voucher.print(draft);

  expect(jobs.rows).toHaveLength(1);
  expect(jobs.rows[0]?.document).toBe("transfer");
  expect(jobs.rows[0]?.commandId).toBe(TRANSFER_ID);
  expect(jobs.rows[0]?.text).toContain(TRANSFER_ID);

  for (const line of LINES) {
    expect(jobs.rows[0]?.text).toContain(
      `${line.ingredientId} ${line.quantity}`,
    );
  }
});
