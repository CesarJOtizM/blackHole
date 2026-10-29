import { type PrintedTicket, Printer } from "#application/ports/printer.js";

export class InMemoryPrinter extends Printer {
  readonly printed: string[] = [];
  fail = false;

  override async print(ticket: PrintedTicket): Promise<void> {
    if (this.fail) {
      throw new Error("The printer is offline.");
    }

    this.printed.push(ticket.text);
  }
}
