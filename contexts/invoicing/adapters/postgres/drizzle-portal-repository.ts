import type { PGlite } from "@electric-sql/pglite";
import { and, eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import {
  acquirerCache,
  consents,
  oneTimeCodes,
  portalLookups,
  portalRateWindows,
  portalSettings,
  portalSubmissions,
  reinvoiceRequests,
  rememberedBuyers,
} from "#adapters/postgres/schema.js";
import {
  type CachedAcquirer,
  PortalBuyerLookupStore,
  type StoredPortalLookup,
} from "#application/look-up-portal-buyer/look-up-portal-buyer.js";
import type { StoredPortalReinvoiceRequest } from "#application/ports/portal-repository.js";
import { PortalRepository } from "#application/ports/portal-repository.js";
import type { PortalLimitAttempt } from "#application/ports/portal-request-limiter.js";
import { PortalRequestLimiter } from "#application/ports/portal-request-limiter.js";
import {
  BillingDataStore,
  type StoredBillingData,
} from "#application/record-billing-data/record-billing-data.js";
import {
  DataDeletionStore,
  type StoredDataDeletion,
} from "#application/request-data-deletion/request-data-deletion.js";
import {
  ReinvoiceRequestStore,
  type StoredReinvoiceRequest,
} from "#application/request-reinvoice/request-reinvoice.js";
import {
  type RememberedContact,
  RememberedContactStore,
  type StoredOneTimeCode,
} from "#application/request-remembered-code/request-remembered-code.js";
import {
  type RememberedBilling,
  RememberedCodeStore,
  type StoredRememberedCode,
} from "#application/verify-remembered-code/verify-remembered-code.js";
import type { BillingDataRecord } from "#domain/billing-data.js";
import type { OneTimeCodeRecord } from "#domain/one-time-code.js";
import {
  REINVOICE_WINDOW_MODE,
  type ReinvoiceWindowMode,
} from "#domain/reinvoice-window.js";

type Database = PgliteDatabase;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface StoredPortalSettings {
  enabled: boolean;
  windowMode: ReinvoiceWindowMode;
}

const inTenant = async <T>(
  database: Database,
  tenantId: string,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> =>
  database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE invoicing_app`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
    );

    return work(tx);
  });

const asPortal = async <T>(
  database: Database,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> =>
  database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE invoicing_app`);

    return work(tx);
  });

const codeFrom = (row: {
  digest: string;
  sentAt: string;
  expiresAt: string;
  attemptsRemaining: number;
  spent: boolean;
}): OneTimeCodeRecord => ({
  digest: row.digest,
  sentAt: row.sentAt,
  expiresAt: row.expiresAt,
  attemptsRemaining: row.attemptsRemaining,
  spent: row.spent,
});

const billingFrom = (row: {
  documentType: string;
  documentNumber: string;
  personType: string;
  name: string;
  email: string;
  municipalityCode: string;
}): RememberedBilling => ({
  documentType: row.documentType,
  documentNumber: row.documentNumber,
  personType: row.personType,
  name: row.name,
  email: row.email,
  municipalityCode: row.municipalityCode,
});

const isWindowMode = (value: string): value is ReinvoiceWindowMode =>
  value === REINVOICE_WINDOW_MODE.SAME_DAY ||
  value === REINVOICE_WINDOW_MODE.SAME_MONTH ||
  value === REINVOICE_WINDOW_MODE.OFF;

export class DrizzleRememberedContactStore extends RememberedContactStore {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<RememberedContact | null> {
    return inTenant(this.database, companyId, async (tx) => {
      const rows = await tx
        .select()
        .from(rememberedBuyers)
        .where(
          and(
            eq(rememberedBuyers.documentType, documentType),
            eq(rememberedBuyers.documentNumber, documentNumber),
          ),
        )
        .limit(1);
      const stored = rows[0];

      if (stored === undefined) {
        return null;
      }

      return {
        companyId: stored.tenantId,
        documentType: stored.documentType,
        documentNumber: stored.documentNumber,
        channel: stored.channel,
        destination: stored.destination,
        name: stored.name,
      };
    });
  }

  override async save(code: StoredOneTimeCode): Promise<void> {
    await inTenant(this.database, code.companyId, async (tx) => {
      await tx
        .insert(oneTimeCodes)
        .values({
          tenantId: code.companyId,
          documentType: code.documentType,
          documentNumber: code.documentNumber,
          digest: code.record.digest,
          sentAt: code.record.sentAt,
          expiresAt: code.record.expiresAt,
          attemptsRemaining: code.record.attemptsRemaining,
          spent: code.record.spent,
        })
        .onConflictDoUpdate({
          target: [
            oneTimeCodes.tenantId,
            oneTimeCodes.documentType,
            oneTimeCodes.documentNumber,
          ],
          set: {
            digest: code.record.digest,
            sentAt: code.record.sentAt,
            expiresAt: code.record.expiresAt,
            attemptsRemaining: code.record.attemptsRemaining,
            spent: code.record.spent,
          },
        });
    });
  }
}

export class DrizzleRememberedCodeStore extends RememberedCodeStore {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<StoredRememberedCode | null> {
    return inTenant(this.database, companyId, async (tx) => {
      const people = await tx
        .select()
        .from(consents)
        .where(
          and(
            eq(consents.documentType, documentType),
            eq(consents.documentNumber, documentNumber),
          ),
        )
        .limit(1);
      const codes = await tx
        .select()
        .from(oneTimeCodes)
        .where(
          and(
            eq(oneTimeCodes.documentType, documentType),
            eq(oneTimeCodes.documentNumber, documentNumber),
          ),
        )
        .limit(1);
      const person = people[0];
      const code = codes[0];

      if (person === undefined || code === undefined) {
        return null;
      }

      return {
        companyId: person.tenantId,
        documentType: person.documentType,
        documentNumber: person.documentNumber,
        billing: billingFrom(person),
        record: codeFrom(code),
      };
    });
  }

  override async save(row: StoredRememberedCode): Promise<void> {
    await inTenant(this.database, row.companyId, async (tx) => {
      await tx
        .insert(consents)
        .values({
          tenantId: row.companyId,
          documentType: row.billing.documentType,
          documentNumber: row.billing.documentNumber,
          personType: row.billing.personType,
          name: row.billing.name,
          email: row.billing.email,
          municipalityCode: row.billing.municipalityCode,
          invoiceSnapshots: [],
        })
        .onConflictDoUpdate({
          target: [
            consents.tenantId,
            consents.documentType,
            consents.documentNumber,
          ],
          set: {
            personType: row.billing.personType,
            name: row.billing.name,
            email: row.billing.email,
            municipalityCode: row.billing.municipalityCode,
          },
        });
      await tx
        .insert(oneTimeCodes)
        .values({
          tenantId: row.companyId,
          documentType: row.documentType,
          documentNumber: row.documentNumber,
          digest: row.record.digest,
          sentAt: row.record.sentAt,
          expiresAt: row.record.expiresAt,
          attemptsRemaining: row.record.attemptsRemaining,
          spent: row.record.spent,
        })
        .onConflictDoUpdate({
          target: [
            oneTimeCodes.tenantId,
            oneTimeCodes.documentType,
            oneTimeCodes.documentNumber,
          ],
          set: {
            digest: row.record.digest,
            sentAt: row.record.sentAt,
            expiresAt: row.record.expiresAt,
            attemptsRemaining: row.record.attemptsRemaining,
            spent: row.record.spent,
          },
        });
    });
  }
}

const recordFrom = (row: {
  documentType: string;
  documentNumber: string;
  personType: string;
  name: string;
  email: string;
  municipalityCode: string;
  acceptedAt: string | null;
  policyVersion: string | null;
  policyLink: string | null;
  deletedAt: string | null;
  invoiceSnapshots: BillingDataRecord["invoiceSnapshots"];
}): BillingDataRecord | null => {
  if (
    row.acceptedAt === null ||
    row.policyVersion === null ||
    row.policyLink === null
  ) {
    return null;
  }

  return {
    documentType: row.documentType,
    documentNumber: row.documentNumber,
    personType: row.personType,
    name: row.name,
    email: row.email,
    municipalityCode: row.municipalityCode,
    consent: {
      acceptedAt: row.acceptedAt,
      policyVersion: row.policyVersion,
      policyLink: row.policyLink,
    },
    deletedAt: row.deletedAt,
    invoiceSnapshots: [...row.invoiceSnapshots],
  };
};

export class DrizzleDataDeletionStore extends DataDeletionStore {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async find(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<StoredDataDeletion | null> {
    return inTenant(this.database, companyId, async (tx) => {
      const people = await tx
        .select()
        .from(consents)
        .where(
          and(
            eq(consents.documentType, documentType),
            eq(consents.documentNumber, documentNumber),
          ),
        )
        .limit(1);
      const codes = await tx
        .select()
        .from(oneTimeCodes)
        .where(
          and(
            eq(oneTimeCodes.documentType, documentType),
            eq(oneTimeCodes.documentNumber, documentNumber),
          ),
        )
        .limit(1);
      const person = people[0];
      const code = codes[0];
      const record = person === undefined ? null : recordFrom(person);

      if (person === undefined || code === undefined || record === null) {
        return null;
      }

      return {
        companyId: person.tenantId,
        documentType: person.documentType,
        documentNumber: person.documentNumber,
        billing: record,
        record: codeFrom(code),
      };
    });
  }

  override async save(row: StoredDataDeletion): Promise<void> {
    await inTenant(this.database, row.companyId, async (tx) => {
      await tx
        .insert(consents)
        .values({
          tenantId: row.companyId,
          documentType: row.billing.documentType,
          documentNumber: row.billing.documentNumber,
          personType: row.billing.personType,
          name: row.billing.name,
          email: row.billing.email,
          municipalityCode: row.billing.municipalityCode,
          acceptedAt: row.billing.consent.acceptedAt,
          policyVersion: row.billing.consent.policyVersion,
          policyLink: row.billing.consent.policyLink,
          deletedAt: row.billing.deletedAt,
          invoiceSnapshots: [...row.billing.invoiceSnapshots],
        })
        .onConflictDoUpdate({
          target: [
            consents.tenantId,
            consents.documentType,
            consents.documentNumber,
          ],
          set: {
            personType: row.billing.personType,
            name: row.billing.name,
            email: row.billing.email,
            municipalityCode: row.billing.municipalityCode,
            acceptedAt: row.billing.consent.acceptedAt,
            policyVersion: row.billing.consent.policyVersion,
            policyLink: row.billing.consent.policyLink,
            deletedAt: row.billing.deletedAt,
            invoiceSnapshots: [...row.billing.invoiceSnapshots],
          },
        });
      await tx
        .insert(oneTimeCodes)
        .values({
          tenantId: row.companyId,
          documentType: row.documentType,
          documentNumber: row.documentNumber,
          digest: row.record.digest,
          sentAt: row.record.sentAt,
          expiresAt: row.record.expiresAt,
          attemptsRemaining: row.record.attemptsRemaining,
          spent: row.record.spent,
        })
        .onConflictDoUpdate({
          target: [
            oneTimeCodes.tenantId,
            oneTimeCodes.documentType,
            oneTimeCodes.documentNumber,
          ],
          set: {
            digest: row.record.digest,
            sentAt: row.record.sentAt,
            expiresAt: row.record.expiresAt,
            attemptsRemaining: row.record.attemptsRemaining,
            spent: row.record.spent,
          },
        });
    });
  }
}

export class DrizzlePortalBuyerLookupStore extends PortalBuyerLookupStore {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async readCache(
    companyId: string,
    documentType: string,
    documentNumber: string,
  ): Promise<CachedAcquirer | null> {
    return inTenant(this.database, companyId, async (tx) => {
      const rows = await tx
        .select()
        .from(acquirerCache)
        .where(
          and(
            eq(acquirerCache.documentType, documentType),
            eq(acquirerCache.documentNumber, documentNumber),
          ),
        )
        .limit(1);
      const stored = rows[0];

      if (stored === undefined) {
        return null;
      }

      return {
        companyId: stored.tenantId,
        documentType: stored.documentType,
        documentNumber: stored.documentNumber,
        name: stored.name,
        email: stored.email,
        cachedAt: stored.cachedAt,
      };
    });
  }

  override async saveCache(row: CachedAcquirer): Promise<void> {
    await inTenant(this.database, row.companyId, async (tx) => {
      await tx
        .insert(acquirerCache)
        .values({
          tenantId: row.companyId,
          documentType: row.documentType,
          documentNumber: row.documentNumber,
          name: row.name,
          email: row.email,
          cachedAt: row.cachedAt,
        })
        .onConflictDoUpdate({
          target: [
            acquirerCache.tenantId,
            acquirerCache.documentType,
            acquirerCache.documentNumber,
          ],
          set: {
            name: row.name,
            email: row.email,
            cachedAt: row.cachedAt,
          },
        });
    });
  }

  override async saveLookup(row: StoredPortalLookup): Promise<void> {
    await inTenant(this.database, row.companyId, async (tx) => {
      await tx.insert(portalLookups).values({
        lookupId: row.lookupId,
        tenantId: row.companyId,
        documentType: row.documentType,
        documentNumber: row.documentNumber,
        name: row.name,
        email: row.email,
      });
    });
  }
}

export class DrizzleBillingDataStore extends BillingDataStore {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async save(row: StoredBillingData): Promise<void> {
    await inTenant(this.database, row.companyId, async (tx) => {
      await tx
        .insert(portalSubmissions)
        .values({
          tenantId: row.companyId,
          checkId: row.checkId,
          documentType: row.record.documentType,
          documentNumber: row.record.documentNumber,
          personType: row.record.personType,
          name: row.record.name,
          email: row.record.email,
          municipalityCode: row.record.municipalityCode,
          acceptedAt: row.record.consent.acceptedAt,
          policyVersion: row.record.consent.policyVersion,
          policyLink: row.record.consent.policyLink,
          deletedAt: row.record.deletedAt,
          invoiceSnapshots: [...row.record.invoiceSnapshots],
        })
        .onConflictDoUpdate({
          target: [portalSubmissions.tenantId, portalSubmissions.checkId],
          set: {
            documentType: row.record.documentType,
            documentNumber: row.record.documentNumber,
            personType: row.record.personType,
            name: row.record.name,
            email: row.record.email,
            municipalityCode: row.record.municipalityCode,
            acceptedAt: row.record.consent.acceptedAt,
            policyVersion: row.record.consent.policyVersion,
            policyLink: row.record.consent.policyLink,
            deletedAt: row.record.deletedAt,
            invoiceSnapshots: [...row.record.invoiceSnapshots],
          },
        });
      await tx
        .insert(consents)
        .values({
          tenantId: row.companyId,
          documentType: row.record.documentType,
          documentNumber: row.record.documentNumber,
          personType: row.record.personType,
          name: row.record.name,
          email: row.record.email,
          municipalityCode: row.record.municipalityCode,
          acceptedAt: row.record.consent.acceptedAt,
          policyVersion: row.record.consent.policyVersion,
          policyLink: row.record.consent.policyLink,
          deletedAt: row.record.deletedAt,
          invoiceSnapshots: [...row.record.invoiceSnapshots],
        })
        .onConflictDoUpdate({
          target: [
            consents.tenantId,
            consents.documentType,
            consents.documentNumber,
          ],
          set: {
            personType: row.record.personType,
            name: row.record.name,
            email: row.record.email,
            municipalityCode: row.record.municipalityCode,
            acceptedAt: row.record.consent.acceptedAt,
            policyVersion: row.record.consent.policyVersion,
            policyLink: row.record.consent.policyLink,
            deletedAt: row.record.deletedAt,
            invoiceSnapshots: [...row.record.invoiceSnapshots],
          },
        });
    });
  }

  override async find(
    companyId: string,
    checkId: string,
  ): Promise<StoredBillingData | null> {
    return inTenant(this.database, companyId, async (tx) => {
      const rows = await tx
        .select()
        .from(portalSubmissions)
        .where(eq(portalSubmissions.checkId, checkId))
        .limit(1);
      const stored = rows[0];

      if (stored === undefined) {
        return null;
      }

      return {
        companyId: stored.tenantId,
        checkId: stored.checkId,
        record: {
          documentType: stored.documentType,
          documentNumber: stored.documentNumber,
          personType: stored.personType,
          name: stored.name,
          email: stored.email,
          municipalityCode: stored.municipalityCode,
          consent: {
            acceptedAt: stored.acceptedAt,
            policyVersion: stored.policyVersion,
            policyLink: stored.policyLink,
          },
          deletedAt: stored.deletedAt,
          invoiceSnapshots: [...stored.invoiceSnapshots],
        },
      };
    });
  }
}

const saveReinvoice = async (
  database: Database,
  row: StoredPortalReinvoiceRequest,
): Promise<void> => {
  await inTenant(database, row.companyId, async (tx) => {
    await tx
      .insert(reinvoiceRequests)
      .values({
        tenantId: row.companyId,
        invoiceNumber: row.invoiceNumber,
        issuedAt: row.issuedAt,
        requestedAt: row.requestedAt,
        status: row.status,
      })
      .onConflictDoUpdate({
        target: [reinvoiceRequests.tenantId, reinvoiceRequests.invoiceNumber],
        set: {
          issuedAt: row.issuedAt,
          requestedAt: row.requestedAt,
          status: row.status,
        },
      });
  });
};

const findReinvoice = async (
  database: Database,
  companyId: string,
  invoiceNumber: string,
): Promise<StoredPortalReinvoiceRequest | null> =>
  inTenant(database, companyId, async (tx) => {
    const rows = await tx
      .select()
      .from(reinvoiceRequests)
      .where(eq(reinvoiceRequests.invoiceNumber, invoiceNumber))
      .limit(1);
    const stored = rows[0];

    if (stored === undefined) {
      return null;
    }

    return {
      companyId: stored.tenantId,
      invoiceNumber: stored.invoiceNumber,
      issuedAt: stored.issuedAt,
      requestedAt: stored.requestedAt,
      status: stored.status,
    };
  });

export class DrizzleReinvoiceRequestStore extends ReinvoiceRequestStore {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async save(row: StoredReinvoiceRequest): Promise<void> {
    await saveReinvoice(this.database, row);
  }

  override async find(
    companyId: string,
    invoiceNumber: string,
  ): Promise<StoredReinvoiceRequest | null> {
    const stored = await findReinvoice(this.database, companyId, invoiceNumber);

    if (stored === null || stored.status !== "pending") {
      return null;
    }

    return { ...stored, status: "pending" };
  }
}

export class DrizzlePortalRepository extends PortalRepository {
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async save(row: StoredPortalReinvoiceRequest): Promise<void> {
    await saveReinvoice(this.database, row);
  }

  override async find(
    companyId: string,
    invoiceNumber: string,
  ): Promise<StoredPortalReinvoiceRequest | null> {
    return findReinvoice(this.database, companyId, invoiceNumber);
  }
}

export class DrizzlePortalSettings {
  private readonly database: Database;

  constructor(client: PGlite) {
    this.database = drizzle(client);
  }

  async open(tenantId: string): Promise<StoredPortalSettings> {
    return inTenant(this.database, tenantId, async (tx) => {
      await tx
        .insert(portalSettings)
        .values({ tenantId })
        .onConflictDoNothing({ target: portalSettings.tenantId });
      const rows = await tx
        .select()
        .from(portalSettings)
        .where(eq(portalSettings.tenantId, tenantId))
        .limit(1);
      const stored = rows[0];

      if (stored === undefined || !isWindowMode(stored.windowMode)) {
        throw new Error("Portal settings are missing.");
      }

      return { enabled: stored.enabled, windowMode: stored.windowMode };
    });
  }
}

export class DrizzlePortalRequestLimiter extends PortalRequestLimiter {
  readonly attempts: PortalLimitAttempt[] = [];
  private readonly database: Database;

  constructor(client: PGlite) {
    super();
    this.database = drizzle(client);
  }

  override async acquire(attempt: PortalLimitAttempt): Promise<boolean> {
    await asPortal(this.database, async (tx) => {
      await tx
        .insert(portalRateWindows)
        .values({ token: attempt.token, ip: attempt.ip })
        .onConflictDoNothing({
          target: [portalRateWindows.token, portalRateWindows.ip],
        });
    });
    this.attempts.push(attempt);

    return true;
  }
}
