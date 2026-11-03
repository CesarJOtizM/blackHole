export class UnknownRegister extends Error {
  constructor() {
    super("The cash register is unknown.");
    this.name = "UnknownRegister";
  }
}

export const REGISTER_DRAWER = {
  PRESENT: "present",
  ABSENT: "absent",
} as const;

export type RegisterDrawer =
  (typeof REGISTER_DRAWER)[keyof typeof REGISTER_DRAWER];

export interface KnownRegister {
  id: string;
  venueId: string;
  drawer: RegisterDrawer;
  printerId: string | null;
}

export abstract class RegisterLookup {
  abstract find(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<KnownRegister | null>;
}
