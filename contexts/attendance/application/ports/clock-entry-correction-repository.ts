export interface ClockEntryCorrection {
  entryId: string;
  occurredAt: string;
  reason: string;
}

export interface ListClockEntryCorrections {
  entryIds: readonly string[];
}

export abstract class ClockEntryCorrectionRepository {
  abstract appendCorrection(correction: ClockEntryCorrection): Promise<void>;

  abstract listCorrections(
    query: ListClockEntryCorrections,
  ): Promise<readonly ClockEntryCorrection[]>;
}
