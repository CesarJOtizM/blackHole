import { expect, it } from "vitest";

import type { NoRestockRepository } from "#application/ports/no-restock-repository.js";
import { NoRestockToday } from "#domain/no-restock-today.js";

const TENANT_A = "organization_tenant_1";
const TENANT_B = "organization_tenant_2";
const VENUE_ID = "venue_site_1";
const PRODUCT_ID = "product_ribs";
const ACTOR_ID = "user_kitchen_chief";
const BEFORE_MIDNIGHT = new Date("2026-11-14T04:59:00.000Z");
const AFTER_MIDNIGHT = new Date("2026-11-14T05:01:00.000Z");
const SERVICE_DATE = "2026-11-13";

const UNCOVERED = {
  pointPortions: 0,
  supplyingWarehousePortions: 0,
  inboundTransfers: [],
} as const;

const proposed = (tenantId: string): NoRestockToday => {
  const mark = NoRestockToday.propose({
    tenantId,
    venueId: VENUE_ID,
    productId: PRODUCT_ID,
    coverage: UNCOVERED,
  });

  if (mark === null) {
    throw new Error("Expected a not-restocked proposal.");
  }

  return mark;
};

const confirmed = (tenantId: string): NoRestockToday => {
  const mark = proposed(tenantId);
  mark.confirm({ actorId: ACTOR_ID, at: BEFORE_MIDNIGHT });
  return mark;
};

const queryFor = (tenantId: string) => ({
  tenantId,
  venueId: VENUE_ID,
  productId: PRODUCT_ID,
});

export function noRestockRepositoryContract(
  createRepository: () => NoRestockRepository | Promise<NoRestockRepository>,
): void {
  it("given a proposal, when it is saved and loaded, then it stays proposed with no actor and no service date", async () => {
    const repository = await createRepository();
    const mark = proposed(TENANT_A);

    await repository.save(mark);

    const loaded = await repository.find(queryFor(TENANT_A));
    expect(loaded).not.toBe(mark);
    expect(loaded?.actorId).toBeNull();
    expect(loaded?.serviceDate).toBeNull();
    expect(loaded?.statusAt(AFTER_MIDNIGHT)).toBe("proposed");
  });

  it("given a confirmed mark stored for tenant A, when tenant B reads the same venue and product, then the mark stays hidden", async () => {
    const repository = await createRepository();
    const mark = confirmed(TENANT_A);

    await repository.save(mark);

    expect(await repository.find(queryFor(TENANT_B))).toBeNull();
    const visible = await repository.find(queryFor(TENANT_A));
    expect(visible?.tenantId).toBe(TENANT_A);
    expect(visible?.actorId).toBe(ACTOR_ID);
    expect(visible?.serviceDate).toBe(SERVICE_DATE);
    expect(visible?.statusAt(BEFORE_MIDNIGHT)).toBe("confirmed");
  });

  it("given a confirmed mark, when a later Bogota date reads it, then the mark is expired and the stored row stays confirmed", async () => {
    const repository = await createRepository();
    const mark = confirmed(TENANT_A);

    await repository.save(mark);

    const loaded = await repository.find(queryFor(TENANT_A));
    expect(loaded).not.toBeNull();
    expect(loaded).not.toBe(mark);
    expect(loaded?.statusAt(BEFORE_MIDNIGHT)).toBe("confirmed");
    expect(loaded?.statusAt(AFTER_MIDNIGHT)).toBe("expired");

    loaded?.remove({ actorId: ACTOR_ID });

    const stored = await repository.find(queryFor(TENANT_A));
    expect(stored?.statusAt(BEFORE_MIDNIGHT)).toBe("confirmed");
    expect(stored?.statusAt(AFTER_MIDNIGHT)).toBe("expired");
  });

  it("given a removed mark, when a later Bogota date reads it, then the mark stays removed", async () => {
    const repository = await createRepository();
    const mark = confirmed(TENANT_A);
    mark.remove({ actorId: ACTOR_ID });

    await repository.save(mark);

    const loaded = await repository.find(queryFor(TENANT_A));
    expect(loaded?.statusAt(BEFORE_MIDNIGHT)).toBe("removed");
    expect(loaded?.statusAt(AFTER_MIDNIGHT)).toBe("removed");
  });
}
