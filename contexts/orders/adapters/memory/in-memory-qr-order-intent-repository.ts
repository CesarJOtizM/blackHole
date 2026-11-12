import {
  QrOrderIntentRepository,
  type StoredQrOrderIntent,
} from "#application/ports/qr-order-intent-repository.js";

const intentKey = (tenantId: string, intentId: string): string =>
  `${tenantId}\u0000${intentId}`;

export class InMemoryQrOrderIntentRepository extends QrOrderIntentRepository {
  private readonly intents = new Map<string, StoredQrOrderIntent>();

  override async find(
    tenantId: string,
    intentId: string,
  ): Promise<StoredQrOrderIntent | null> {
    const stored = this.intents.get(intentKey(tenantId, intentId));

    return stored === undefined ? null : structuredClone(stored);
  }

  override async insert(intent: StoredQrOrderIntent): Promise<void> {
    const key = intentKey(intent.tenantId, intent.id);

    if (this.intents.has(key)) {
      throw new Error("A QR order intent identifier is already in use.");
    }

    this.intents.set(key, structuredClone(intent));
  }

  override async save(intent: StoredQrOrderIntent): Promise<void> {
    this.intents.set(
      intentKey(intent.tenantId, intent.id),
      structuredClone(intent),
    );
  }

  override async list(
    tenantId: string,
    venueId: string,
  ): Promise<readonly StoredQrOrderIntent[]> {
    return [...this.intents.values()]
      .filter(
        (intent) => intent.tenantId === tenantId && intent.venueId === venueId,
      )
      .map((intent) => structuredClone(intent));
  }
}
