export interface PreBillLinkInput {
  tenantId: string;
  venueId: string;
  checkId: string;
  at: string;
}

export abstract class PreBillLink {
  abstract sign(input: PreBillLinkInput): Promise<string>;
}
