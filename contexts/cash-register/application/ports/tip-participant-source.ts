export interface TipParticipantQuery {
  tenantId: string;
  venueId: string;
  from: string;
  to: string;
}

export interface TipParticipant {
  userId: string;
  workedMinutes: number;
}

export abstract class TipParticipantSource {
  abstract list(query: TipParticipantQuery): Promise<readonly TipParticipant[]>;
}
