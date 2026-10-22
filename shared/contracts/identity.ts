import { z } from "zod";

const IDENTITY_COMMAND = {
  SIGN_IN_ADMINISTRATION: "signInAdministration",
  ENROLL_SECOND_FACTOR: "enrollSecondFactor",
  REQUIRE_SECOND_FACTOR: "requireSecondFactor",
  START_PIN_SESSION: "startPinSession",
  RECORD_ACTIVITY: "recordActivity",
  DEACTIVATE_USER: "deactivateUser",
} as const;

const SESSION_KIND = {
  ADMINISTRATION: "administration",
  PIN: "pin",
  STATION: "station",
} as const;

const DEVICE_KIND = {
  PERSONAL: "personal",
  FIXED_STATION: "fixed-station",
} as const;

const signInAdministrationCommand = z.object({
  type: z.literal(IDENTITY_COMMAND.SIGN_IN_ADMINISTRATION),
  userId: z.string(),
  password: z.string(),
  factorCode: z.string().nullable(),
  sessionId: z.string(),
});

const enrollSecondFactorCommand = z.object({
  type: z.literal(IDENTITY_COMMAND.ENROLL_SECOND_FACTOR),
  userId: z.string(),
  code: z.string(),
});

const requireSecondFactorCommand = z.object({
  type: z.literal(IDENTITY_COMMAND.REQUIRE_SECOND_FACTOR),
  userId: z.string(),
  code: z.string(),
});

const startPinSessionCommand = z.object({
  type: z.literal(IDENTITY_COMMAND.START_PIN_SESSION),
  userId: z.string(),
  deviceId: z.string(),
  pin: z.string(),
  sessionId: z.string(),
  idleLockMs: z.number(),
});

const recordActivityCommand = z.object({
  type: z.literal(IDENTITY_COMMAND.RECORD_ACTIVITY),
  sessionId: z.string(),
});

const deactivateUserCommand = z.object({
  type: z.literal(IDENTITY_COMMAND.DEACTIVATE_USER),
  userId: z.string(),
});

const identityCommand = z.discriminatedUnion("type", [
  signInAdministrationCommand,
  enrollSecondFactorCommand,
  requireSecondFactorCommand,
  startPinSessionCommand,
  recordActivityCommand,
  deactivateUserCommand,
]);

const identityUser = z.object({
  id: z.string(),
  displayName: z.string(),
  active: z.boolean(),
  secondFactorEnrolled: z.boolean(),
  failedFactorAttempts: z.number(),
});

const identityDevice = z.object({
  id: z.string(),
  venueId: z.string(),
  kind: z.union([
    z.literal(DEVICE_KIND.PERSONAL),
    z.literal(DEVICE_KIND.FIXED_STATION),
  ]),
  stationId: z.string().nullable(),
  publicKey: z.string(),
  pinAttemptsLocked: z.boolean(),
  pinFailures: z.number(),
  revoked: z.boolean(),
});

const registrationCode = z.object({
  id: z.string(),
  venueId: z.string(),
  expiresAt: z.number(),
  failedRedeems: z.number(),
  locked: z.boolean(),
  used: z.boolean(),
});

const identitySession = z.object({
  sessionId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  deviceId: z.string(),
  venueId: z.string(),
  kind: z.union([
    z.literal(SESSION_KIND.ADMINISTRATION),
    z.literal(SESSION_KIND.PIN),
    z.literal(SESSION_KIND.STATION),
  ]),
});

const identitySnapshot = z.object({
  tenantId: z.string(),
  users: z.array(identityUser),
  devices: z.array(identityDevice),
  registrationCodes: z.array(registrationCode),
  sessions: z.array(identitySession),
});

export const identityRequest = z.object({
  siteOffline: z.boolean(),
  command: identityCommand,
});

export type IdentityRequest = z.infer<typeof identityRequest>;

export const identityChanged = z.object({
  before: identitySnapshot,
  after: identitySnapshot,
});

export type IdentityChanged = z.infer<typeof identityChanged>;
