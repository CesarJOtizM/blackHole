import type { ClockKind, ClockPresence } from "#domain/worker-shift.js";

export interface ClockEntry {
  id: string;
  tenantId: string;
  venueId: string;
  userId: string;
  deviceId: string;
  kind: ClockKind;
  presence: ClockPresence;
  occurredAt: string;
  commandId: string;
  cashRegisterId: string | null;
  pendingReview: boolean;
}

export interface ListClockEntries {
  tenantId: string;
  venueId: string;
  userId: string;
}

export abstract class ClockEntryRepository {
  abstract append(entry: ClockEntry): Promise<void>;

  abstract list(query: ListClockEntries): Promise<readonly ClockEntry[]>;

  abstract listByVenue(
    tenantId: string,
    venueId: string,
  ): Promise<readonly ClockEntry[]>;
}
