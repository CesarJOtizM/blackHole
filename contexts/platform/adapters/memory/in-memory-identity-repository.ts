import type { IdentityChanged } from "#application/ports/identity-repository.js";
import { IdentityRepository } from "#application/ports/identity-repository.js";
import type { Identity } from "#domain/identity.js";

export class InMemoryIdentityRepository extends IdentityRepository {
  private readonly identities = new Map<string, Identity>();
  private readonly events = new Map<string, IdentityChanged[]>();

  override async load(tenantId: string): Promise<Identity | null> {
    return this.identities.get(tenantId) ?? null;
  }

  override async save(
    identity: Identity,
    event: IdentityChanged,
  ): Promise<void> {
    const recorded = this.events.get(identity.tenantId) ?? [];
    recorded.push(event);
    this.identities.set(identity.tenantId, identity);
    this.events.set(identity.tenantId, recorded);
  }

  async eventsFor(tenantId: string): Promise<readonly IdentityChanged[]> {
    return (this.events.get(tenantId) ?? []).map((event) => ({
      before: event.before,
      after: event.after,
    }));
  }
}
