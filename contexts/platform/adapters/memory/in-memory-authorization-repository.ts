import type { AuthorizationChanged } from "#application/ports/authorization-repository.js";
import { AuthorizationRepository } from "#application/ports/authorization-repository.js";
import type { Authorization } from "#domain/authorization.js";

export class InMemoryAuthorizationRepository extends AuthorizationRepository {
  private readonly authorizations = new Map<string, Authorization>();
  private readonly events = new Map<string, AuthorizationChanged[]>();

  override async load(tenantId: string): Promise<Authorization | null> {
    return this.authorizations.get(tenantId) ?? null;
  }

  override async save(
    authorization: Authorization,
    event: AuthorizationChanged,
  ): Promise<void> {
    const recorded = this.events.get(authorization.tenantId) ?? [];
    recorded.push({
      before: event.before,
      after: event.after,
    });
    this.authorizations.set(authorization.tenantId, authorization);
    this.events.set(authorization.tenantId, recorded);
  }

  async eventsFor(tenantId: string): Promise<readonly AuthorizationChanged[]> {
    return (this.events.get(tenantId) ?? []).map((event) => ({
      before: event.before,
      after: event.after,
    }));
  }
}
