import {
  Printer,
  type PrintJobRequest,
  type PrintJobStatus,
  type QueuedPrintJob,
} from "#application/ports/printer.js";

export class InMemoryPrinter extends Printer {
  readonly jobs: PrintJobRequest[] = [];
  fail = false;

  override async enqueue(job: PrintJobRequest): Promise<QueuedPrintJob> {
    this.jobs.push(job);

    return {
      status: this.status(),
      kickDrawer: job.kickDrawer,
    };
  }

  private status(): PrintJobStatus {
    return this.fail ? "failed" : "waiting";
  }
}
