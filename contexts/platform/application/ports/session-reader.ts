export const SESSION_KIND = {
  ADMINISTRATION: "administration",
  PIN: "pin",
} as const;

export type SessionKind = (typeof SESSION_KIND)[keyof typeof SESSION_KIND];

export interface SessionView {
  sessionId: string;
  userId: string;
  displayName: string;
  deviceId: string;
  venueId: string | null;
  kind: SessionKind;
}

export abstract class SessionReader {
  abstract find(
    tenantId: string,
    sessionId: string,
  ): Promise<SessionView | null>;
}
