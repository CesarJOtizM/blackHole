import {
  ACQUIRER_LOOKUP,
  type AcquirerLookup,
  type InvoicingProvider,
} from "#application/ports/invoicing-provider.js";
import { maskEmail, maskName } from "#domain/masking.js";

export const PORTAL_LOOKUP_LINK = {
  HIDDEN: "hidden",
  VISIBLE: "visible",
} as const;

export type PortalLookupLink =
  (typeof PORTAL_LOOKUP_LINK)[keyof typeof PORTAL_LOOKUP_LINK];

export const PORTAL_BUYER_LOOKUP = {
  FOUND: "found",
  HIDDEN: "hidden",
} as const;

const LOOKUP_RATE_CEILING = 60;
const THIRTY_DAYS_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

export interface LookUpPortalBuyerCommand {
  lookupId: string;
  taxId: string;
  companyId: string;
  documentType: string;
  documentNumber: string;
  at: string;
  link: PortalLookupLink;
}

export interface CachedAcquirer {
  companyId: string;
  documentType: string;
  documentNumber: string;
  name: string;
  email: string;
  cachedAt: string;
}

export interface StoredPortalLookup {
  lookupId: string;
  companyId: string;
  documentType: string;
  documentNumber: string;
  name: string;
  email: string;
}

export type PortalBuyerLookupResult =
  | { outcome: typeof PORTAL_BUYER_LOOKUP.HIDDEN }
  | {
      outcome: typeof PORTAL_BUYER_LOOKUP.FOUND;
      lookupId: string;
      maskedName: string;
      maskedEmail: string;
    };

export abstract class PortalLookupLimiter {
  abstract acquire(taxId: string, at: string, ceiling: number): Promise<void>;
}

export abstract class PortalBuyerLookupStore {
  abstract readCache(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<CachedAcquirer | null>;

  abstract saveCache(row: CachedAcquirer): Promise<void>;

  abstract saveLookup(row: StoredPortalLookup): Promise<void>;
}

const hiddenResult = (): PortalBuyerLookupResult => ({
  outcome: PORTAL_BUYER_LOOKUP.HIDDEN,
});

const sameDocument = (
  cached: CachedAcquirer,
  command: LookUpPortalBuyerCommand,
): boolean =>
  cached.companyId === command.companyId &&
  cached.documentType === command.documentType &&
  cached.documentNumber === command.documentNumber;

const freshCache = (cachedAt: string, at: string): boolean => {
  const cachedTime = Date.parse(cachedAt);
  const atTime = Date.parse(at);

  if (!Number.isFinite(cachedTime) || !Number.isFinite(atTime)) {
    return false;
  }

  const age = atTime - cachedTime;

  return age >= 0 && age <= THIRTY_DAYS_IN_MILLISECONDS;
};

export class LookUpPortalBuyer {
  constructor(
    private readonly store: PortalBuyerLookupStore,
    private readonly limiter: PortalLookupLimiter,
    private readonly provider: InvoicingProvider,
  ) {}

  async execute(
    command: LookUpPortalBuyerCommand,
  ): Promise<PortalBuyerLookupResult> {
    if (command.link === PORTAL_LOOKUP_LINK.HIDDEN) {
      return hiddenResult();
    }

    const cached = await this.store.readCache(
      command.companyId,
      command.documentType,
      command.documentNumber,
    );

    if (
      cached &&
      sameDocument(cached, command) &&
      freshCache(cached.cachedAt, command.at)
    ) {
      return this.remember(command, cached.name, cached.email);
    }

    try {
      await this.limiter.acquire(
        command.taxId,
        command.at,
        LOOKUP_RATE_CEILING,
      );
    } catch {
      return hiddenResult();
    }

    const lookup = await this.lookUp(command);

    if (!lookup || lookup.outcome !== ACQUIRER_LOOKUP.FOUND) {
      return hiddenResult();
    }

    await this.store.saveCache({
      companyId: command.companyId,
      documentType: command.documentType,
      documentNumber: command.documentNumber,
      name: lookup.name,
      email: lookup.email,
      cachedAt: command.at,
    });

    return this.remember(command, lookup.name, lookup.email);
  }

  private async lookUp(
    command: LookUpPortalBuyerCommand,
  ): Promise<AcquirerLookup | null> {
    try {
      return await this.provider.lookupAcquirer({
        documentType: command.documentType,
        documentNumber: command.documentNumber,
      });
    } catch {
      return null;
    }
  }

  private async remember(
    command: LookUpPortalBuyerCommand,
    name: string,
    email: string,
  ): Promise<PortalBuyerLookupResult> {
    await this.store.saveLookup({
      lookupId: command.lookupId,
      companyId: command.companyId,
      documentType: command.documentType,
      documentNumber: command.documentNumber,
      name,
      email,
    });

    return {
      outcome: PORTAL_BUYER_LOOKUP.FOUND,
      lookupId: command.lookupId,
      maskedName: maskName(name),
      maskedEmail: maskEmail(email),
    };
  }
}
