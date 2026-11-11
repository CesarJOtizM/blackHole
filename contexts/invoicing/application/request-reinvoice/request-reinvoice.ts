import type { InvoicingProvider } from "#application/ports/invoicing-provider.js";
import {
  isReinvoiceWindowOpen,
  type ReinvoiceWindowMode,
} from "#domain/reinvoice-window.js";

export const REQUEST_REINVOICE = {
  REJECTED: "rejected",
  RECORDED: "recorded",
} as const;

export const REINVOICE_REQUEST_STATUS = {
  PENDING: "pending",
} as const;

export interface RequestReinvoiceCommand {
  companyId: string;
  invoiceNumber: string;
  issuedAt: string;
  at: string;
  windowMode?: ReinvoiceWindowMode;
}

export interface StoredReinvoiceRequest {
  companyId: string;
  invoiceNumber: string;
  issuedAt: string;
  requestedAt: string;
  status: typeof REINVOICE_REQUEST_STATUS.PENDING;
}

export type RequestReinvoiceResult =
  | { outcome: typeof REQUEST_REINVOICE.REJECTED }
  | { outcome: typeof REQUEST_REINVOICE.RECORDED };

export abstract class ReinvoiceRequestStore {
  abstract save(row: StoredReinvoiceRequest): Promise<void>;

  abstract find(
    companyId: string,
    invoiceNumber: string,
  ): Promise<StoredReinvoiceRequest | null>;
}

const recorded = (): RequestReinvoiceResult => ({
  outcome: REQUEST_REINVOICE.RECORDED,
});

const rejected = (): RequestReinvoiceResult => ({
  outcome: REQUEST_REINVOICE.REJECTED,
});

export class RequestReinvoice {
  constructor(
    private readonly requests: ReinvoiceRequestStore,
    _provider: InvoicingProvider,
  ) {}

  async execute(
    command: RequestReinvoiceCommand,
  ): Promise<RequestReinvoiceResult> {
    const open = isReinvoiceWindowOpen({
      issuedAt: command.issuedAt,
      at: command.at,
      mode: command.windowMode,
    });

    if (!open) {
      return rejected();
    }

    const existing = await this.requests.find(
      command.companyId,
      command.invoiceNumber,
    );

    if (existing !== null) {
      return recorded();
    }

    await this.requests.save({
      companyId: command.companyId,
      invoiceNumber: command.invoiceNumber,
      issuedAt: command.issuedAt,
      requestedAt: command.at,
      status: REINVOICE_REQUEST_STATUS.PENDING,
    });

    return recorded();
  }
}
