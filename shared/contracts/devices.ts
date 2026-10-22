import { z } from "zod";

import { identityChanged } from "#contracts/identity.js";

const DEVICE_COMMAND = {
  ISSUE_REGISTRATION_CODE: "issueRegistrationCode",
  REGISTER_DEVICE: "registerDevice",
  REVOKE_DEVICE: "revokeDevice",
  OPEN_FIXED_STATION: "openFixedStation",
  AUTHORIZE_OPERATION: "authorizeOperation",
} as const;

const issueRegistrationCodeCommand = z.object({
  type: z.literal(DEVICE_COMMAND.ISSUE_REGISTRATION_CODE),
  id: z.string(),
  venueId: z.string(),
  code: z.string(),
});

const registerDeviceCommand = z.object({
  type: z.literal(DEVICE_COMMAND.REGISTER_DEVICE),
  registrationId: z.string(),
  code: z.string(),
  deviceId: z.string(),
  userId: z.string(),
  venueId: z.string(),
  publicKey: z.string(),
  signature: z.string().nullable(),
});

const revokeDeviceCommand = z.object({
  type: z.literal(DEVICE_COMMAND.REVOKE_DEVICE),
  deviceId: z.string(),
  signature: z.string().nullable(),
});

const openFixedStationCommand = z.object({
  type: z.literal(DEVICE_COMMAND.OPEN_FIXED_STATION),
  deviceId: z.string(),
  sessionId: z.string(),
  stationId: z.string(),
  signature: z.string().nullable(),
});

const authorizeOperationCommand = z.object({
  type: z.literal(DEVICE_COMMAND.AUTHORIZE_OPERATION),
  deviceId: z.string(),
  stationId: z.string().nullable(),
  signature: z.string().nullable(),
});

const deviceCommand = z.discriminatedUnion("type", [
  issueRegistrationCodeCommand,
  registerDeviceCommand,
  revokeDeviceCommand,
  openFixedStationCommand,
  authorizeOperationCommand,
]);

export const deviceRequest = z.object({
  siteOffline: z.boolean(),
  command: deviceCommand,
});

export type DeviceRequest = z.infer<typeof deviceRequest>;

export const deviceResult = identityChanged.extend({
  registrationCode: z.string().optional(),
});

export type DeviceResult = z.infer<typeof deviceResult>;
