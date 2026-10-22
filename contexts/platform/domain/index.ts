export const layer = "domain" as const;

export {
  Authorization,
  DuplicateAuthorizationId,
  LastOwnerRemains,
  LimitRaised,
  PredefinedRoleRevision,
  PrivilegeEscalation,
  ReasonRequired,
  RequestExpired,
  ScopeRejected,
  SelfAuthorizationDenied,
  UnknownAuthorizationReference,
} from "#domain/authorization.js";
export { evaluate } from "#domain/evaluate.js";
export {
  DeviceRevoked,
  DuplicateIdentityId,
  Identity,
  InvalidIdentityId,
  PasswordRejected,
  PinAttemptsLocked,
  PinRejected,
  RegistrationCodeExpired,
  RegistrationCodeLocked,
  RegistrationCodeRejected,
  RegistrationCodeReused,
  SecondFactorRejected,
  SecondFactorRequired,
  StationRefused,
  UnknownIdentityReference,
  UserDeactivated,
} from "#domain/identity.js";
export {
  DuplicateNit,
  DuplicateOrganizationId,
  InvalidOrganizationId,
  InvoicingTaxpayerAlreadyAssigned,
  Organization,
  PointAlreadyOpen,
  StockNotHeld,
  UnknownOrganizationReference,
} from "#domain/organization.js";
export { StaleGeneration, VenueOperation } from "#domain/venue-operation.js";
