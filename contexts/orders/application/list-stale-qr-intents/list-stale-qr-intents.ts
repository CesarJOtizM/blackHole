import type { Clock } from "#application/ports/clock.js";
import type { QrOrderIntentRepository } from "#application/ports/qr-order-intent-repository.js";
import type { TableQrRepository } from "#application/ports/table-qr-repository.js";

export const STALE_AFTER_SECONDS = 900;

export interface ListStaleQrIntentsInput {
  tenantId: string;
  venueId: string;
}

export interface StaleQrIntent {
  intentId: string;
  ageSeconds: number;
}

export class ListStaleQrIntents {
  constructor(
    private readonly intents: QrOrderIntentRepository,
    private readonly tokens: TableQrRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    input: ListStaleQrIntentsInput,
  ): Promise<readonly StaleQrIntent[]> {
    const settings = await this.tokens.loadSettings(
      input.tenantId,
      input.venueId,
    );
    const rows = await this.intents.list(input.tenantId, input.venueId);
    const now = this.clock.now();

    return rows.flatMap((intent) => {
      if (intent.status !== "pending_acceptance") {
        return [];
      }

      const ageSeconds = Math.floor(
        (now - Date.parse(intent.createdAt)) / 1000,
      );

      if (ageSeconds < settings.staleAfterSeconds) {
        return [];
      }

      return [{ intentId: intent.id, ageSeconds }];
    });
  }
}
