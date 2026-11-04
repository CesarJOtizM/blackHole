import { InMemoryCashRegisterRepository } from "@blackhole/cash-register/adapters/memory/in-memory-cash-register-repository";
import {
  CashShift,
  type OriginalPayment,
  OriginalPaymentReader,
  type PaidAccount,
  PaidAccountReader,
} from "@blackhole/cash-register/application/entry-port";
import {
  FakeClock,
  FastPasswordHasher,
  FastPinHasher,
  FastSecondFactor,
} from "@blackhole/platform/adapters/memory/fast-identity-doubles";
import { FastSignatureVerifier } from "@blackhole/platform/adapters/memory/fast-signature-verifier";
import { InMemoryAuditRepository } from "@blackhole/platform/adapters/memory/in-memory-audit-repository";
import { InMemoryAuthorizationRepository } from "@blackhole/platform/adapters/memory/in-memory-authorization-repository";
import { InMemoryFileStorage } from "@blackhole/platform/adapters/memory/in-memory-file-storage";
import { InMemoryIdentityRepository } from "@blackhole/platform/adapters/memory/in-memory-identity-repository";
import { InMemoryOrganizationRepository } from "@blackhole/platform/adapters/memory/in-memory-organization-repository";
import { InMemoryRuntimeMetrics } from "@blackhole/platform/adapters/memory/in-memory-runtime-metrics";
import { InMemorySecrets } from "@blackhole/platform/adapters/memory/in-memory-secrets";
import { InMemoryVenueOperationRepository } from "@blackhole/platform/adapters/memory/in-memory-venue-operation-repository";
import type { OrganizationSnapshot } from "@blackhole/platform/application/ports/organization-repository";
import {
  Authorization,
  Identity,
  Organization,
} from "@blackhole/platform/domain";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import { authorizationDependencies } from "#src/composition/authorization-access.js";
import { createApplication } from "#src/composition/create-application.js";
import {
  openedAt,
  ownerId,
  sessionHeader,
  tenantId,
  venueId,
} from "#test/http/dining-room-session.js";

export const kitchenChiefId = "user_kitchen";
export const registerId = "organization_register_front";
export const absentRegisterId = "organization_register_absent";
export const silentRegisterId = "organization_register_silent";
export const printerId = "printer_front";
export const paymentId = "payment_original";
export const reversalId = "reversal_paid";
export const replacementId = "payment_replacement";
export const closedShiftId = "shift_closed";
export const openShiftId = "shift_open";
export const openingFloatCop = 80_000;
export const amountCop = 45_000;
export const reason = "Counted drawer";

const people = [
  [ownerId, "session_owner", "owner"],
  [kitchenChiefId, "session_kitchen", "kitchenChief"],
] as const;

const picture = (organization: Organization): OrganizationSnapshot => ({
  id: organization.id,
  name: organization.name,
  taxpayers: organization.taxpayers,
  brands: organization.brands,
  venues: organization.venues,
  locations: organization.locations,
  kitchenStations: organization.kitchenStations,
  cashRegisters: organization.cashRegisters,
});

export class ReplacingCashRegisterRepository extends InMemoryCashRegisterRepository {
  private readonly replaced = new Map<string, CashShift>();

  override async load(
    tenantId: string,
    venueId: string,
    registerId: string,
  ): Promise<CashShift | null> {
    const stored = this.replaced.get(this.key(tenantId, venueId, registerId));

    if (stored !== undefined) {
      return stored;
    }

    return super.load(tenantId, venueId, registerId);
  }

  override async save(
    tenantId: string,
    venueId: string,
    shift: CashShift,
  ): Promise<void> {
    const current = await super.load(tenantId, venueId, shift.registerId);

    if (current === null) {
      await super.save(tenantId, venueId, shift);
      return;
    }

    this.replaced.set(this.key(tenantId, venueId, shift.registerId), shift);
  }

  private key(tenantId: string, venueId: string, registerId: string): string {
    return `${tenantId}\u0000${venueId}\u0000${registerId}`;
  }
}

export class SeededPaidAccount extends PaidAccountReader {
  constructor(private readonly account: PaidAccount) {
    super();
  }

  override find(
    _tenantId: string,
    _venueId: string,
    _paymentId: string,
  ): Promise<PaidAccount> {
    return Promise.resolve(this.account);
  }
}

export class SeededOriginalPayment extends OriginalPaymentReader {
  constructor(private readonly payment: OriginalPayment) {
    super();
  }

  override find(
    _tenantId: string,
    _venueId: string,
    _paymentId: string,
  ): Promise<OriginalPayment> {
    return Promise.resolve(this.payment);
  }
}

export const paidSale = {
  paymentId,
  amountCop,
  shiftId: closedShiftId,
};

export const saveRegisters = async (
  registers: readonly {
    id: string;
    drawer: "present" | "absent";
    printerId: string | null;
  }[],
): Promise<InMemoryOrganizationRepository> => {
  const organizations = new InMemoryOrganizationRepository();
  const organization = Organization.registerCompany({
    id: tenantId,
    name: "Pilot",
  });

  organization.addTaxpayer({
    id: "organization_taxpayer_1",
    nit: "900123",
    taxProfileId: "organization_tax_1",
  });
  organization.addBrand({ id: "organization_brand_1", name: "Brand" });
  organization.openVenue({
    id: venueId,
    name: "Site one",
    brandId: "organization_brand_1",
    taxpayerId: "organization_taxpayer_1",
    pointId: "organization_point_1",
  });

  for (const register of registers) {
    organization.addCashRegister({
      id: register.id,
      venueId,
      name: "Front",
      drawer: register.drawer,
      printerId: register.printerId,
    });
  }

  const stored = picture(organization);

  await organizations.save(organization, {
    actorId: ownerId,
    before: stored,
    after: stored,
  });

  return organizations;
};

export const seedOpenShift = async (
  registers: InMemoryCashRegisterRepository,
  id: string,
): Promise<CashShift> => {
  const closed = CashShift.forRegister(id);

  closed.open({
    id: closedShiftId,
    cashierId: ownerId,
    openingFloatCop,
  });

  const open = CashShift.forRegister(id);

  open.open({
    id: openShiftId,
    cashierId: ownerId,
    openingFloatCop,
  });
  await registers.save(tenantId, venueId, open);

  return closed;
};

export const openCashActionCloud = async (deps?: {
  organizations?: InMemoryOrganizationRepository;
  registers?: InMemoryCashRegisterRepository;
  paidAccounts?: PaidAccountReader;
  originalPayments?: OriginalPaymentReader;
}): Promise<{
  application: NestFastifyApplication;
  registers: InMemoryCashRegisterRepository;
  audits: InMemoryAuditRepository;
}> => {
  const identities = new InMemoryIdentityRepository();
  const authorizations = new InMemoryAuthorizationRepository();
  const registers = deps?.registers ?? new InMemoryCashRegisterRepository();
  const audits = new InMemoryAuditRepository();
  const passwords = new FastPasswordHasher();
  const identity = Identity.open(tenantId);

  for (const [userId, sessionId] of people) {
    identity.registerUser({
      id: userId,
      displayName: userId,
      passwordHash: await passwords.hash("secret"),
      pinHash: `pin-hash:${userId}`,
    });
    identity.signInAdministration({
      userId,
      passwordHash: await passwords.hash("secret"),
      factorHash: null,
      sessionId,
    });
  }

  const signedIn = identity.snapshot();

  await identities.save(identity, { before: signedIn, after: signedIn });

  const authorization = Authorization.restore({
    tenantId,
    customRoles: [],
    assignments: people.map(([userId, , roleId]) => ({
      id: `assignment_${roleId}`,
      userId,
      roleId,
      scopeKind: "company" as const,
      scopeId: tenantId,
      validFrom: null,
      validUntil: null,
    })),
    venueLimits: [],
    bartenderCharge: [],
    requests: [],
    resolutions: [],
    supportGrants: [],
    supportActions: [],
    shiftFlags: [],
    notices: [],
  });

  await authorizations.save(authorization, {
    before: Authorization.open(tenantId).snapshot(),
    after: authorization.snapshot(),
  });

  const application = await createApplication({
    venueOperations: new InMemoryVenueOperationRepository(),
    organizations: deps?.organizations ?? new InMemoryOrganizationRepository(),
    identities,
    passwords,
    pins: new FastPinHasher(),
    secondFactor: new FastSecondFactor(),
    clock: new FakeClock(Date.parse(openedAt)),
    signatures: new FastSignatureVerifier(),
    ...authorizationDependencies(
      identities,
      new FakeClock(Date.parse(openedAt)),
    ),
    authorizations,
    audits,
    registers,
    ...(deps?.paidAccounts === undefined
      ? {}
      : { paidAccounts: deps.paidAccounts }),
    ...(deps?.originalPayments === undefined
      ? {}
      : { originalPayments: deps.originalPayments }),
    fileStorage: new InMemoryFileStorage(),
    secrets: new InMemorySecrets({}),
    metrics: new InMemoryRuntimeMetrics(),
  });

  return { application, registers, audits };
};

export const cashPath = (suffix: string): string =>
  `/tenants/${tenantId}/venues/${venueId}/${suffix}`;

export const postCash = (
  application: NestFastifyApplication,
  url: string,
  sessionId: string | null,
  payload: unknown,
): Promise<{ statusCode: number; json: () => unknown }> =>
  application.inject({
    method: "POST",
    url,
    ...(sessionId === null ? {} : { headers: { [sessionHeader]: sessionId } }),
    payload: payload as Record<string, unknown>,
  });
