export const PORTAL_REINVOICE_REQUEST_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
} as const;

export type PortalReinvoiceRequestStatus =
  (typeof PORTAL_REINVOICE_REQUEST_STATUS)[keyof typeof PORTAL_REINVOICE_REQUEST_STATUS];

export interface StoredPortalReinvoiceRequest {
  companyId: string;
  invoiceNumber: string;
  issuedAt: string;
  requestedAt: string;
  status: PortalReinvoiceRequestStatus;
}

export abstract class PortalRepository {
  abstract save(row: StoredPortalReinvoiceRequest): Promise<void>;

  abstract find(
    companyId: string,
    invoiceNumber: string,
  ): Promise<StoredPortalReinvoiceRequest | null>;
}
