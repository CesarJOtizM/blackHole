export const openIssuanceStatuses = ["pending_issuance", "uncertain"] as const;

export type OpenIssuanceStatus = (typeof openIssuanceStatuses)[number];

export interface PendingIssuanceSnapshot {
  venueId: string;
  status: OpenIssuanceStatus;
  ageSeconds: number;
}

export const salesDocumentStatuses = [
  "generated",
  "sending",
  "accepted",
  "rejected",
  "pending_issuance",
  "uncertain",
] as const;

export type SalesDocumentStatus = (typeof salesDocumentStatuses)[number];

export interface SyntheticPendingDocument {
  id: string;
  venueId: string;
  status: SalesDocumentStatus;
  requestedAt: number;
}

export function isOpenIssuanceStatus(
  status: string,
): status is OpenIssuanceStatus {
  return status === "pending_issuance" || status === "uncertain";
}

export function issuanceAgeSeconds(requestedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - requestedAt) / 1000));
}

export abstract class PendingIssuance {
  abstract snapshot(): Promise<PendingIssuanceSnapshot[]>;
}
