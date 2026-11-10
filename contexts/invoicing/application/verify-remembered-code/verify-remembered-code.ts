import type { CodeDigest } from "#application/ports/code-digest.js";
import {
  type OneTimeCodeDigest,
  type OneTimeCodeRecord,
  verifyOneTimeCode,
} from "#domain/one-time-code.js";

export const REMEMBERED_CODE_VERIFICATION = {
  REVEALED: "revealed",
  HIDDEN: "hidden",
} as const;

export interface RememberedBilling {
  documentType: string;
  documentNumber: string;
  personType: string;
  name: string;
  email: string;
  municipalityCode: string;
}

export interface StoredRememberedCode {
  companyId: string;
  documentType: string;
  documentNumber: string;
  billing: RememberedBilling;
  record: OneTimeCodeRecord;
}

export interface VerifyRememberedCodeCommand {
  companyId: string;
  documentType: string;
  documentNumber: string;
  code: string;
  at: string;
}

export type VerifyRememberedCodeResult =
  | { outcome: typeof REMEMBERED_CODE_VERIFICATION.HIDDEN }
  | {
      outcome: typeof REMEMBERED_CODE_VERIFICATION.REVEALED;
      billing: RememberedBilling;
    };

export abstract class RememberedCodeStore {
  abstract find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<StoredRememberedCode | null>;

  abstract save(row: StoredRememberedCode): Promise<void>;
}

const hidden = (): VerifyRememberedCodeResult => ({
  outcome: REMEMBERED_CODE_VERIFICATION.HIDDEN,
});

const sameHolder = (
  row: StoredRememberedCode,
  command: VerifyRememberedCodeCommand,
): boolean =>
  row.companyId === command.companyId &&
  row.documentType === command.documentType &&
  row.documentNumber === command.documentNumber &&
  row.billing.documentType === command.documentType &&
  row.billing.documentNumber === command.documentNumber;

const compared =
  (digests: CodeDigest, stored: string): OneTimeCodeDigest =>
  (code) =>
    digests.matches(code, stored) ? stored : `${stored}:miss`;

export class VerifyRememberedCode {
  constructor(
    private readonly codes: RememberedCodeStore,
    private readonly digests: CodeDigest,
  ) {}

  async execute(
    command: VerifyRememberedCodeCommand,
  ): Promise<VerifyRememberedCodeResult> {
    const row = await this.codes.find(
      command.companyId,
      command.documentType,
      command.documentNumber,
    );

    if (!row || !sameHolder(row, command) || command.code.trim().length === 0) {
      return hidden();
    }

    const verification = verifyOneTimeCode({
      record: row.record,
      code: command.code,
      digest: compared(this.digests, row.record.digest),
      at: command.at,
    });

    await this.codes.save({ ...row, record: verification.record });

    if (verification.outcome !== "accepted") {
      return hidden();
    }

    return {
      outcome: REMEMBERED_CODE_VERIFICATION.REVEALED,
      billing: { ...row.billing },
    };
  }
}
