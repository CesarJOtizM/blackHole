export class UnknownRegister extends Error {
  constructor() {
    super("The cash register is unknown.");
    this.name = "UnknownRegister";
  }
}

export interface KnownRegister {
  id: string;
  venueId: string;
}

export abstract class RegisterLookup {
  abstract find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<KnownRegister | null>;
}
