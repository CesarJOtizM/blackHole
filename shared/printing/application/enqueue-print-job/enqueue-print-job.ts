import type { PaperWidth, PrintDocument } from "#domain/render.js";
import {
  type KitchenTicketLine,
  type PreBillLine,
  type RenderedTemplate,
  renderCashClose,
  renderInvoice,
  renderKitchenTicket,
  renderOfflineReceipt,
  renderPreBill,
  renderTipsSettlement,
  renderTransfer,
  type TipsSettlementLine,
} from "#domain/templates.js";

export class PrinterNotConfigured extends Error {
  constructor() {
    super("The printer is not configured.");
    this.name = "PrinterNotConfigured";
  }
}

export interface ConfiguredPrinter {
  id: string;
  paper: PaperWidth;
}

export abstract class PrinterRepository {
  abstract save(printer: ConfiguredPrinter): Promise<void>;

  abstract find(id: string): Promise<ConfiguredPrinter | null>;
}

export interface PrintJob {
  id: string;
  commandId: string;
  printerId: string;
  document: PrintDocument;
  paper: PaperWidth;
  status: "waiting";
  kickDrawer: boolean;
  columns: number;
  text: string;
  pulse: Uint8Array | null;
}

export abstract class PrintJobRepository {
  abstract findByCommand(commandId: string): Promise<PrintJob | null>;

  abstract insert(job: PrintJob): Promise<void>;
}

interface PrintCommand {
  commandId: string;
  printerId: string;
  kickDrawer: boolean;
}

export type EnqueuePrintJobCommand =
  | (PrintCommand & {
      document: "kitchen_ticket";
      station: string;
      table: string;
      lines: readonly KitchenTicketLine[];
    })
  | (PrintCommand & {
      document: "pre_bill";
      table: string;
      lines: readonly PreBillLine[];
      total: string;
      qr: string;
    })
  | (PrintCommand & {
      document: "invoice";
      number: string;
      cufe: string;
      qr: string;
    })
  | (PrintCommand & {
      document: "offline_receipt";
      lookupQr: string;
    })
  | (PrintCommand & {
      document: "cash_close";
      register: string;
      expected: string;
      counted: string;
      difference: string;
    })
  | (PrintCommand & {
      document: "transfer";
      reference: string;
      origin: string;
      destination: string;
      lines: readonly string[];
      qr: string;
    })
  | (PrintCommand & {
      document: "tips_settlement";
      period: string;
      lines: readonly TipsSettlementLine[];
      total: string;
    });

const renderJob = (
  command: EnqueuePrintJobCommand,
  paper: PaperWidth,
): RenderedTemplate => {
  const kickDrawer = command.kickDrawer;

  switch (command.document) {
    case "kitchen_ticket":
      return renderKitchenTicket({
        paper,
        kickDrawer,
        station: command.station,
        table: command.table,
        lines: command.lines,
      });
    case "pre_bill":
      return renderPreBill({
        paper,
        kickDrawer,
        table: command.table,
        lines: command.lines,
        total: command.total,
        qr: command.qr,
      });
    case "invoice":
      return renderInvoice({
        paper,
        kickDrawer,
        number: command.number,
        cufe: command.cufe,
        qr: command.qr,
      });
    case "offline_receipt":
      return renderOfflineReceipt({
        paper,
        kickDrawer,
        lookupQr: command.lookupQr,
      });
    case "cash_close":
      return renderCashClose({
        paper,
        kickDrawer,
        register: command.register,
        expected: command.expected,
        counted: command.counted,
        difference: command.difference,
      });
    case "transfer":
      return renderTransfer({
        paper,
        kickDrawer,
        reference: command.reference,
        origin: command.origin,
        destination: command.destination,
        lines: command.lines,
        qr: command.qr,
      });
    case "tips_settlement":
      return renderTipsSettlement({
        paper,
        kickDrawer,
        period: command.period,
        lines: command.lines,
        total: command.total,
      });
  }
};

export const savePrinter = (
  printers: PrinterRepository,
  printer: ConfiguredPrinter,
): Promise<void> => printers.save(printer);

export class EnqueuePrintJob {
  constructor(
    private readonly printers: PrinterRepository,
    private readonly jobs: PrintJobRepository,
  ) {}

  async execute(command: EnqueuePrintJobCommand): Promise<PrintJob> {
    const existing = await this.jobs.findByCommand(command.commandId);

    if (existing) {
      return existing;
    }

    const printer = await this.printers.find(command.printerId);

    if (!printer) {
      throw new PrinterNotConfigured();
    }

    const rendered = renderJob(command, printer.paper);
    const job: PrintJob = {
      id: `print_job_${command.commandId}`,
      commandId: command.commandId,
      printerId: command.printerId,
      document: command.document,
      paper: printer.paper,
      status: "waiting",
      kickDrawer: command.kickDrawer,
      columns: rendered.columns,
      text: rendered.text,
      pulse: rendered.pulse,
    };

    await this.jobs.insert(job);

    return job;
  }
}
