import type { Clock } from "#application/ports/clock.js";
import {
  isOpenIssuanceStatus,
  issuanceAgeSeconds,
  PendingIssuance,
  type PendingIssuanceSnapshot,
  type SyntheticPendingDocument,
} from "#application/ports/pending-issuance.js";

export class InMemoryPendingIssuance extends PendingIssuance {
  private readonly documents: SyntheticPendingDocument[] = [];

  constructor(private readonly clock: Clock) {
    super();
  }

  async record(document: SyntheticPendingDocument): Promise<void> {
    this.documents.push(document);
  }

  override async snapshot(): Promise<PendingIssuanceSnapshot[]> {
    const now = this.clock.now();

    return this.documents
      .filter(
        (
          document,
        ): document is SyntheticPendingDocument & {
          status: PendingIssuanceSnapshot["status"];
        } => isOpenIssuanceStatus(document.status),
      )
      .sort((left, right) => {
        if (left.requestedAt !== right.requestedAt) {
          return left.requestedAt - right.requestedAt;
        }

        return left.id.localeCompare(right.id);
      })
      .map((document) => ({
        venueId: document.venueId,
        status: document.status,
        ageSeconds: issuanceAgeSeconds(document.requestedAt, now),
      }));
  }
}
