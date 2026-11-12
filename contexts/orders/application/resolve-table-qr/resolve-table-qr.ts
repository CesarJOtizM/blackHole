import type { TableQrRepository } from "#application/ports/table-qr-repository.js";
import { TableQrToken } from "#domain/table-qr-token.js";

export interface ResolveTableQrInput {
  token: string;
}

export interface ResolvedTableQr {
  tenantId: string;
  venueId: string;
  tableId: string;
}

export class TableQrUnknown extends Error {
  constructor() {
    super("The table QR is not recognized.");
    this.name = "TableQrUnknown";
  }
}

export class TableQrRetired extends Error {
  constructor() {
    super("The table QR was reprinted.");
    this.name = "TableQrRetired";
  }
}

export class TableQrDisabled extends Error {
  constructor() {
    super("Table QR ordering is disabled.");
    this.name = "TableQrDisabled";
  }
}

export class ResolveTableQr {
  constructor(private readonly tokens: TableQrRepository) {}

  async execute(input: ResolveTableQrInput): Promise<ResolvedTableQr> {
    const record = await this.tokens.findByDigest(
      TableQrToken.digest(input.token),
    );

    if (record === null) {
      throw new TableQrUnknown();
    }

    if (record.retired) {
      throw new TableQrRetired();
    }

    const settings = await this.tokens.loadSettings(
      record.tenantId,
      record.venueId,
    );

    if (!settings.enabled) {
      throw new TableQrDisabled();
    }

    return {
      tenantId: record.tenantId,
      venueId: record.venueId,
      tableId: record.tableId,
    };
  }
}
