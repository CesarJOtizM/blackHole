export interface ClockEntryCorrection {
  tenantId: string;
  entryId: string;
  occurredAt: string;
  reason: string;
}

export interface ListClockEntryCorrections {
  tenantId: string;
  entryIds: readonly string[];
}

export abstract class ClockEntryCorrectionRepository {
  abstract appendCorrection(correction: ClockEntryCorrection): Promise<void>;

  abstract listCorrections(
    query: ListClockEntryCorrections,
  ): Promise<readonly ClockEntryCorrection[]>;
}
