export interface PrintedTicket {
  text: string;
}

export abstract class Printer {
  abstract print(ticket: PrintedTicket): Promise<void>;
}
