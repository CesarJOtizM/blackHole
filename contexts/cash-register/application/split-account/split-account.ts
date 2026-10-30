import { UnknownAccount } from "#application/charge-check/charge-check.js";
import type {
  AccountCheck,
  AccountGateway,
} from "#application/ports/account-gateway.js";
import type { AccountSplitStore } from "#application/ports/account-split-store.js";
import {
  type RegisterLookup,
  UnknownRegister,
} from "#application/ports/register-lookup.js";
import { AccountSplit } from "#domain/account-split.js";

interface SplitScope {
  tenantId: string;
  venueId: string;
  registerId: string;
  checkId: string;
}

export interface EqualSplitAccountInput extends SplitScope {
  kind: "equal";
  partIds: readonly string[];
}

export interface AmountSplitAccountInput extends SplitScope {
  kind: "amounts";
  parts: readonly { id: string; amountCop: number }[];
}

export interface LineSplitAccountInput extends SplitScope {
  kind: "lines";
  parts: readonly { id: string; lineIds: readonly string[] }[];
}

export type SplitAccountInput =
  | EqualSplitAccountInput
  | AmountSplitAccountInput
  | LineSplitAccountInput;

export interface PayAccountPartInput extends SplitScope {
  partId: string;
}

const knownRegister = async (
  lookup: RegisterLookup,
  tenantId: string,
  venueId: string,
  registerId: string,
): Promise<void> => {
  const known = await lookup.find(tenantId, venueId, registerId);

  if (known === null || known.id !== registerId || known.venueId !== venueId) {
    throw new UnknownRegister();
  }
};

const originTableIdOf = (check: AccountCheck): string =>
  check.lines[0]?.originTableId ?? check.tableId;

const recordedSplit = (
  check: AccountCheck,
  input: SplitAccountInput,
): AccountSplit => {
  const originTableId = originTableIdOf(check);

  if (input.kind === "equal") {
    return AccountSplit.equal({
      accountCop: check.accountCop,
      originTableId,
      partIds: input.partIds,
    });
  }

  if (input.kind === "amounts") {
    return AccountSplit.create({
      accountCop: check.accountCop,
      parts: input.parts.map((part) => ({
        id: part.id,
        amountCop: part.amountCop,
        originTableId,
      })),
    });
  }

  return AccountSplit.assign({
    accountCop: check.accountCop,
    lines: check.lines.map((line) => ({
      id: line.lineId,
      amountCop: line.priceCop,
      originTableId: line.originTableId,
    })),
    parts: input.parts,
  });
};

export class SplitAccount {
  constructor(
    private readonly registerLookup: RegisterLookup,
    private readonly accounts: AccountGateway,
    private readonly splits: AccountSplitStore,
  ) {}

  async execute(input: SplitAccountInput): Promise<AccountSplit> {
    await knownRegister(
      this.registerLookup,
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const check = await this.accounts.findCheck(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (check === null || check.checkId !== input.checkId) {
      throw new UnknownAccount();
    }

    const split = recordedSplit(check, input);

    await this.splits.save(input.tenantId, input.venueId, input.checkId, split);

    return split;
  }

  async pay(input: PayAccountPartInput): Promise<AccountSplit> {
    await knownRegister(
      this.registerLookup,
      input.tenantId,
      input.venueId,
      input.registerId,
    );
    const split = await this.splits.find(
      input.tenantId,
      input.venueId,
      input.checkId,
    );

    if (split === null) {
      throw new UnknownAccount();
    }

    split.pay(input.partId);
    await this.splits.save(input.tenantId, input.venueId, input.checkId, split);

    return split;
  }
}
