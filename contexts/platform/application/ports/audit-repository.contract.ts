import { expect, it } from "vitest";

import {
  type AuditEvent,
  AuditRepository,
} from "#application/ports/audit-repository.js";

const GENESIS = "0".repeat(64);

const event = (
  tenantId: string,
  deviceId: string,
  siteId: string,
): AuditEvent => ({
  tenantId,
  actorId: "user_cashier",
  authorizerId: null,
  deviceId,
  siteId,
  action: "sale.void-account",
  entity: "check_1",
  before: { amount: 20_000, nested: { tax: 1 } },
  after: { amount: 0 },
  reason: "customer left",
  occurredAt: 1_700_000_000_000,
  sequence: 1,
  previousHash: GENESIS,
  digest: "ab".repeat(32),
  kind: "event",
});

export function auditRepositoryContract(
  createRepository: () => AuditRepository | Promise<AuditRepository>,
): void {
  it("given an audit event, when it is appended, then list returns the same event", async () => {
    const repository = await createRepository();
    const stored = event(
      "organization_company_saved",
      "device_phone_saved",
      "organization_venue_saved",
    );

    await repository.append(stored);

    expect(await repository.list(stored.tenantId, stored.deviceId)).toEqual([
      stored,
    ]);
  });

  it("given companies A and B, when tenant A lists, then tenant B stays hidden", async () => {
    const repository = await createRepository();
    const companyA = "organization_company_a";
    const companyB = "organization_company_b";
    const phone = event(companyA, "device_phone", "organization_venue_a");
    const register = event(companyA, "device_register", "organization_venue_a");
    const other = event(companyB, "device_phone", "organization_venue_b");

    await repository.append(phone);
    await repository.append(register);
    await repository.append(other);

    expect(await repository.list(companyA, "device_phone")).toEqual([phone]);
    expect(await repository.list(companyA, null)).toEqual([phone, register]);
    expect(await repository.list(companyB, null)).toEqual([other]);
  });

  it("given an audit repository, when its operations are listed, then only append and list exist", async () => {
    const repository = await createRepository();
    const operations = Object.getOwnPropertyNames(
      Object.getPrototypeOf(repository),
    )
      .filter((name) => name !== "constructor")
      .sort();

    expect(operations).toEqual(["append", "list"]);
    expect(AuditRepository.prototype).not.toHaveProperty("update");
    expect(AuditRepository.prototype).not.toHaveProperty("delete");
  });
}
