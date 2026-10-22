export interface IdentityView {
  userId: string;
  active: boolean;
}

export abstract class IdentityReader {
  abstract find(
    tenantId: string,
    userId: string,
  ): Promise<IdentityView | null>;
}
