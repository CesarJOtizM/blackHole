import type {
  OneTimeCodeChannel,
  OneTimeCodeSender,
} from "#application/ports/one-time-code-sender.js";
import {
  issueOneTimeCode,
  ONE_TIME_CODE_TTL_MS,
  type OneTimeCodeDigest,
  type OneTimeCodeDigit,
  type OneTimeCodeRecord,
} from "#domain/one-time-code.js";

export const REMEMBERED_CODE_REQUEST = {
  SENT: "sent",
  HIDDEN: "hidden",
} as const;

const EXPIRES_IN_MINUTES = ONE_TIME_CODE_TTL_MS / (60 * 1000);

export interface RememberedContact {
  companyId: string;
  documentType: string;
  documentNumber: string;
  channel: OneTimeCodeChannel;
  destination: string;
  name: string;
}

export interface StoredOneTimeCode {
  companyId: string;
  documentType: string;
  documentNumber: string;
  record: OneTimeCodeRecord;
}

export interface RequestRememberedCodeCommand {
  companyId: string;
  companyName: string;
  documentType: string;
  documentNumber: string;
  at: string;
  typedDestination: string;
}

export type RequestRememberedCodeResult =
  | { outcome: typeof REMEMBERED_CODE_REQUEST.SENT }
  | { outcome: typeof REMEMBERED_CODE_REQUEST.HIDDEN };

export abstract class RememberedContactStore {
  abstract find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<RememberedContact | null>;

  abstract save(code: StoredOneTimeCode): Promise<void>;
}

const hidden = (): RequestRememberedCodeResult => ({
  outcome: REMEMBERED_CODE_REQUEST.HIDDEN,
});

const sameHolder = (
  row: RememberedContact,
  command: RequestRememberedCodeCommand,
): boolean =>
  row.companyId === command.companyId &&
  row.documentType === command.documentType &&
  row.documentNumber === command.documentNumber;

export class RequestRememberedCode {
  constructor(
    private readonly contacts: RememberedContactStore,
    private readonly sender: OneTimeCodeSender,
    private readonly digest: OneTimeCodeDigest,
    private readonly nextDigit: OneTimeCodeDigit,
  ) {}

  async execute(
    command: RequestRememberedCodeCommand,
  ): Promise<RequestRememberedCodeResult> {
    const row = await this.contacts.find(
      command.companyId,
      command.documentType,
      command.documentNumber,
    );

    if (!row || !sameHolder(row, command)) {
      return hidden();
    }

    const issued = issueOneTimeCode({
      at: command.at,
      digest: this.digest,
      nextDigit: this.nextDigit,
    });

    await this.sender.send({
      channel: row.channel,
      destination: row.destination,
      code: issued.code,
      companyName: command.companyName,
      expiresInMinutes: EXPIRES_IN_MINUTES,
    });

    await this.contacts.save({
      companyId: command.companyId,
      documentType: command.documentType,
      documentNumber: command.documentNumber,
      record: issued.record,
    });

    return { outcome: REMEMBERED_CODE_REQUEST.SENT };
  }
}
