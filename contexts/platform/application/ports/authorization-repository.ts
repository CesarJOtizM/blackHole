import type {
  Authorization,
  AuthorizationSnapshot,
} from "#domain/authorization.js";

export type { AuthorizationSnapshot };

export interface AuthorizationChanged {
  before: AuthorizationSnapshot;
  after: AuthorizationSnapshot;
}

export abstract class AuthorizationRepository {
  abstract load(tenantId: string): Promise<Authorization | null>;

  abstract save(
    authorization: Authorization,
    event: AuthorizationChanged,
  ): Promise<void>;
}
