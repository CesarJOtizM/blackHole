import type { AccountSplit } from "#domain/account-split.js";

export abstract class AccountSplitStore {
  abstract find(
    tenantId: string,
    venueId: string,
    checkId: string,
  ): Promise<AccountSplit | null>;

  abstract save(
    tenantId: string,
    venueId: string,
    checkId: string,
    split: AccountSplit,
  ): Promise<void>;
}
