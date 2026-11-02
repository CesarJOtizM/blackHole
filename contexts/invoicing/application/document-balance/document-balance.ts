export const DOCUMENT_BALANCE_SCOPE = {
  COMPANY: "company",
  NIT: "nit",
  SITE: "site",
} as const;

export type DocumentBalanceScope =
  (typeof DOCUMENT_BALANCE_SCOPE)[keyof typeof DOCUMENT_BALANCE_SCOPE];

export const DOCUMENT_BALANCE_COLOR = {
  NONE: "none",
  YELLOW: "yellow",
  RED: "red",
} as const;

export type DocumentBalanceColor =
  (typeof DOCUMENT_BALANCE_COLOR)[keyof typeof DOCUMENT_BALANCE_COLOR];

export type RaisedDocumentBalanceColor = Exclude<
  DocumentBalanceColor,
  typeof DOCUMENT_BALANCE_COLOR.NONE
>;

export const DOCUMENT_BALANCE_ALERT_AUDIENCE = {
  COMPANY_ADMIN: "company_admin",
  SUPPORT: "support",
} as const;

export type DocumentBalanceAlertAudience =
  (typeof DOCUMENT_BALANCE_ALERT_AUDIENCE)[keyof typeof DOCUMENT_BALANCE_ALERT_AUDIENCE];

export const DOCUMENT_BALANCE_ALERT_AUDIENCES = [
  DOCUMENT_BALANCE_ALERT_AUDIENCE.COMPANY_ADMIN,
  DOCUMENT_BALANCE_ALERT_AUDIENCE.SUPPORT,
] as const;

export interface DocumentBalanceKey {
  companyId: string;
  nit: string;
  siteId: string;
}

export interface OpeningDocumentBalance extends DocumentBalanceKey {
  remaining: number;
}

export interface ScopedAcceptanceCount {
  scope: DocumentBalanceScope;
  scopeId: string;
  count: number;
}

export abstract class DocumentBalanceStore {
  abstract readRemaining(key: DocumentBalanceKey): Promise<number | null>;

  abstract saveRemaining(balance: OpeningDocumentBalance): Promise<void>;

  abstract readCount(
    scope: DocumentBalanceScope,
    scopeId: string,
  ): Promise<number>;

  abstract saveCount(count: ScopedAcceptanceCount): Promise<void>;
}

export interface DocumentBalanceAlertNotice {
  companyId: string;
  nit: string;
  siteId: string;
  color: RaisedDocumentBalanceColor;
  audiences: readonly DocumentBalanceAlertAudience[];
}

export abstract class DocumentBalanceAlert {
  abstract raise(alert: DocumentBalanceAlertNotice): Promise<void>;
}

export interface CountedDocumentAcceptance {
  companyCount: number;
  nitCount: number;
  siteCount: number;
  remaining: number;
  days: number | null;
  color: DocumentBalanceColor;
}

export interface CountDocumentAcceptanceCommand extends DocumentBalanceKey {
  pace: number;
}

const YELLOW_UNDER_DAYS = 15;
const RED_UNDER_DAYS = 5;

const colorFor = (days: number | null): DocumentBalanceColor => {
  if (days === null || days >= YELLOW_UNDER_DAYS) {
    return DOCUMENT_BALANCE_COLOR.NONE;
  }

  if (days < RED_UNDER_DAYS) {
    return DOCUMENT_BALANCE_COLOR.RED;
  }

  return DOCUMENT_BALANCE_COLOR.YELLOW;
};

export class SetDocumentBalance {
  constructor(private readonly balances: DocumentBalanceStore) {}

  async execute(
    command: OpeningDocumentBalance,
  ): Promise<OpeningDocumentBalance> {
    const opening: OpeningDocumentBalance = {
      companyId: command.companyId,
      nit: command.nit,
      siteId: command.siteId,
      remaining: command.remaining,
    };

    await this.balances.saveRemaining(opening);

    return opening;
  }
}

export class CountDocumentAcceptance {
  constructor(
    private readonly balances: DocumentBalanceStore,
    private readonly alerts: DocumentBalanceAlert,
  ) {}

  async execute(
    command: CountDocumentAcceptanceCommand,
  ): Promise<CountedDocumentAcceptance> {
    const companyCount = await this.increment(
      DOCUMENT_BALANCE_SCOPE.COMPANY,
      command.companyId,
    );
    const nitCount = await this.increment(
      DOCUMENT_BALANCE_SCOPE.NIT,
      command.nit,
    );
    const siteCount = await this.increment(
      DOCUMENT_BALANCE_SCOPE.SITE,
      command.siteId,
    );
    const remaining = (await this.balances.readRemaining(command)) ?? 0;
    const days = command.pace === 0 ? null : remaining / command.pace;
    const color = colorFor(days);

    if (color !== DOCUMENT_BALANCE_COLOR.NONE) {
      await this.alerts.raise({
        companyId: command.companyId,
        nit: command.nit,
        siteId: command.siteId,
        color,
        audiences: DOCUMENT_BALANCE_ALERT_AUDIENCES,
      });
    }

    return {
      companyCount,
      nitCount,
      siteCount,
      remaining,
      days,
      color,
    };
  }

  private async increment(
    scope: DocumentBalanceScope,
    scopeId: string,
  ): Promise<number> {
    const count = (await this.balances.readCount(scope, scopeId)) + 1;

    await this.balances.saveCount({ scope, scopeId, count });

    return count;
  }
}
