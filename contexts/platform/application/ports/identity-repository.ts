import type { Identity, IdentitySnapshot } from "#domain/identity.js";

export interface IdentityChanged {
  before: IdentitySnapshot;
  after: IdentitySnapshot;
}

export abstract class IdentityRepository {
  abstract load(tenantId: string): Promise<Identity | null>;

  abstract save(identity: Identity, event: IdentityChanged): Promise<void>;
}
