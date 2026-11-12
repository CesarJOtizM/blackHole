import {
  type EvaluatePermission,
  PERMISSION,
} from "@blackhole/platform/application/entry-port";

import type { TableQrRepository } from "#application/ports/table-qr-repository.js";
import { TableQrToken } from "#domain/table-qr-token.js";

export interface IssueTableQrInput {
  tenantId: string;
  venueId: string;
  tableId: string;
  nonce: string;
  sessionId: string;
}

export interface IssuedTableQr {
  plaintext: string;
  path: string;
  digest: string;
}

export class TableQrReprintRefused extends Error {
  constructor() {
    super("Reprinting a table QR requires sale.reprint.");
    this.name = "TableQrReprintRefused";
  }
}

export class IssueTableQr {
  constructor(
    private readonly tokens: TableQrRepository,
    private readonly permissions: EvaluatePermission,
  ) {}

  async execute(input: IssueTableQrInput): Promise<IssuedTableQr> {
    const decision = await this.permissions.execute({
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      permission: PERMISSION.SALE_REPRINT,
      target: { kind: "site", id: input.venueId, brandId: null },
      value: null,
      supportGrantId: null,
      shiftTotals: { waiterVoidsBeforeKitchen: 0 },
    });

    if (decision.outcome !== "allowed") {
      throw new TableQrReprintRefused();
    }

    const issued = TableQrToken.issue({
      tenantId: input.tenantId,
      venueId: input.venueId,
      tableId: input.tableId,
      nonce: input.nonce,
    });

    await this.tokens.retireActive(
      input.tenantId,
      input.venueId,
      input.tableId,
    );
    await this.tokens.save({
      tenantId: input.tenantId,
      venueId: input.venueId,
      tableId: input.tableId,
      digest: issued.digest,
      retired: false,
    });

    return {
      plaintext: issued.plaintext,
      path: issued.path,
      digest: issued.digest,
    };
  }
}
