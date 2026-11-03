import { RegisterLookup } from "@blackhole/cash-register/application/entry-port";
import type { OrganizationRepository } from "@blackhole/platform/application/ports/organization-repository";

export class OrganizationRegisterDirectory extends RegisterLookup {
  constructor(private readonly organizations: OrganizationRepository) {
    super();
  }

  override async find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<{
    id: string;
    venueId: string;
    drawer: "present" | "absent";
    printerId: string | null;
  } | null> {
    const organization = await this.organizations.load(tenantId);
    const register = organization?.cashRegisters.find(
      (item) => item.id === registerId && item.venueId === venueId,
    );

    if (!register) {
      return null;
    }

    return {
      id: register.id,
      venueId: register.venueId,
      drawer: register.drawer,
      printerId: register.printerId,
    };
  }
}
