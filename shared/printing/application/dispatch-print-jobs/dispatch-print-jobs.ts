export interface DispatchablePrintJob {
  id: string;
  printerId: string;
  status: "waiting" | "printed" | "failed";
  text: string;
  deliveredPrinterId: string | null;
}

export abstract class DispatchJobRepository {
  abstract listWaiting(): Promise<DispatchablePrintJob[]>;

  abstract save(job: DispatchablePrintJob): Promise<void>;
}

export interface DispatchPrinter {
  id: string;
  retryLimit: number;
  backupPrinterId: string | null;
}

export abstract class DispatchPrinterRepository {
  abstract find(id: string): Promise<DispatchPrinter | null>;
}

export interface PrintDelivery {
  printerId: string;
  jobId: string;
  text: string;
}

export abstract class PrintTransport {
  abstract send(delivery: PrintDelivery): Promise<void>;
}

const printed = (
  job: DispatchablePrintJob,
  deliveredPrinterId: string,
): DispatchablePrintJob => ({
  ...job,
  status: "printed",
  deliveredPrinterId,
});

const failed = (job: DispatchablePrintJob): DispatchablePrintJob => ({
  ...job,
  status: "failed",
  deliveredPrinterId: null,
});

export class DispatchPrintJobs {
  constructor(
    private readonly jobs: DispatchJobRepository,
    private readonly printers: DispatchPrinterRepository,
    private readonly transport: PrintTransport,
  ) {}

  async execute(): Promise<readonly DispatchablePrintJob[]> {
    const waiting = await this.jobs.listWaiting();
    const dispatched: DispatchablePrintJob[] = [];

    for (const job of waiting) {
      const next = await this.dispatchJob(job);

      await this.jobs.save(next);
      dispatched.push(next);
    }

    return dispatched;
  }

  private async dispatchJob(
    job: DispatchablePrintJob,
  ): Promise<DispatchablePrintJob> {
    const printer = await this.printers.find(job.printerId);

    if (!printer) {
      return failed(job);
    }

    if (await this.sendPrimary(job, printer)) {
      return printed(job, printer.id);
    }

    if (printer.backupPrinterId === null) {
      return failed(job);
    }

    const delivered = await this.trySend(job, printer.backupPrinterId);

    return delivered ? printed(job, printer.backupPrinterId) : failed(job);
  }

  private async sendPrimary(
    job: DispatchablePrintJob,
    printer: DispatchPrinter,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < printer.retryLimit; attempt += 1) {
      if (await this.trySend(job, printer.id)) {
        return true;
      }
    }

    return false;
  }

  private async trySend(
    job: DispatchablePrintJob,
    printerId: string,
  ): Promise<boolean> {
    try {
      await this.transport.send({
        printerId,
        jobId: job.id,
        text: job.text,
      });

      return true;
    } catch {
      return false;
    }
  }
}
