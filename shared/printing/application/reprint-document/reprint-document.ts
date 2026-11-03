export class ReprintCapUnconfigured extends Error {
  constructor() {
    super("The reprint cap is not configured.");
    this.name = "ReprintCapUnconfigured";
  }
}

export interface ReprintAuditEvent {
  action: "sale.reprint";
  actorId: string;
  deviceId: string;
  document: string;
  occurredAt: string;
}

export abstract class ReprintAudit {
  abstract record(event: ReprintAuditEvent): Promise<void>;
}

export interface ReprintDocumentCommand {
  actorId: string;
  deviceId: string;
  document: string;
  occurredAt: string;
  limit: number | null;
}

export class ReprintDocument {
  constructor(private readonly audits: ReprintAudit) {}

  async execute(command: ReprintDocumentCommand): Promise<void> {
    if (command.limit === null) {
      throw new ReprintCapUnconfigured();
    }

    await this.audits.record({
      action: "sale.reprint",
      actorId: command.actorId,
      deviceId: command.deviceId,
      document: command.document,
      occurredAt: command.occurredAt,
    });
  }
}
