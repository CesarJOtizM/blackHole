import type { OrganizationChanged } from "#application/ports/organization-repository.js";
import { OrganizationRepository } from "#application/ports/organization-repository.js";
import type { Organization } from "#domain/organization.js";

export class InMemoryOrganizationRepository extends OrganizationRepository {
  private readonly organizations = new Map<string, Organization>();
  private readonly events = new Map<string, OrganizationChanged[]>();

  override async load(tenantId: string): Promise<Organization | null> {
    return this.organizations.get(tenantId) ?? null;
  }

  override async save(
    organization: Organization,
    event: OrganizationChanged,
  ): Promise<void> {
    const recorded = this.events.get(organization.id) ?? [];
    recorded.push(event);
    this.organizations.set(organization.id, organization);
    this.events.set(organization.id, recorded);
  }

  async eventsFor(tenantId: string): Promise<readonly OrganizationChanged[]> {
    return (this.events.get(tenantId) ?? []).map((event) => ({
      actorId: event.actorId,
      before: event.before,
      after: event.after,
    }));
  }
}
