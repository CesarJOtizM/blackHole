import { createHash } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,}$/;
const PATH_PREFIX = "/m/";

interface IssueTableQr {
  tenantId: string;
  venueId: string;
  tableId: string;
  nonce: string;
}

export class InvalidTableQrNonce extends Error {
  constructor() {
    super("A table QR nonce must be one URL segment.");
    this.name = "InvalidTableQrNonce";
  }
}

const sha256 = (plaintext: string): string =>
  createHash("sha256").update(plaintext).digest("hex");

export class TableQrToken {
  readonly tenantId: string;
  readonly venueId: string;
  readonly tableId: string;
  readonly plaintext: string;
  readonly digest: string;
  readonly path: string;

  private constructor(input: {
    tenantId: string;
    venueId: string;
    tableId: string;
    plaintext: string;
  }) {
    this.tenantId = input.tenantId;
    this.venueId = input.venueId;
    this.tableId = input.tableId;
    this.plaintext = input.plaintext;
    this.digest = sha256(input.plaintext);
    this.path = `${PATH_PREFIX}${input.plaintext}`;
  }

  static issue(input: IssueTableQr): TableQrToken {
    if (!TOKEN_PATTERN.test(input.nonce)) {
      throw new InvalidTableQrNonce();
    }

    return new TableQrToken({
      tenantId: input.tenantId,
      venueId: input.venueId,
      tableId: input.tableId,
      plaintext: input.nonce,
    });
  }

  static digest(plaintext: string): string {
    return sha256(plaintext);
  }

  rotate(nonce: string): TableQrToken {
    return TableQrToken.issue({
      tenantId: this.tenantId,
      venueId: this.venueId,
      tableId: this.tableId,
      nonce,
    });
  }

  isCurrent(_at: string): boolean {
    return true;
  }
}
