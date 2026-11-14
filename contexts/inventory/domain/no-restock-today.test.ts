import { expect, it } from "vitest";

import { MissingActor, NoRestockToday } from "#domain/no-restock-today.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "venue_site_1";
const RIBS_ID = "product_ribs";
const KITCHEN_CHIEF_ID = "user_kitchen_chief";
const BEFORE_MIDNIGHT = new Date("2026-11-14T04:59:00.000Z");
const AFTER_MIDNIGHT = new Date("2026-11-14T05:01:00.000Z");

const coverage = (
  pointPortions: number,
  supplyingWarehousePortions: number,
  inboundTransfers: readonly { status: string }[] = [],
) => ({
  pointPortions,
  supplyingWarehousePortions,
  inboundTransfers,
});

const propose = (
  pointPortions: number,
  supplyingWarehousePortions: number,
  inboundTransfers: readonly { status: string }[] = [],
) =>
  NoRestockToday.propose({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: RIBS_ID,
    coverage: coverage(
      pointPortions,
      supplyingWarehousePortions,
      inboundTransfers,
    ),
  });

it("given portions below 1 and a transfer that is not dispatched or in transit, when availability is evaluated, then a proposal is raised and stock stays unchanged", () => {
  const stock = coverage(0, 0.25, [
    { status: "requested" },
    { status: "received" },
  ]);
  const before = {
    pointPortions: stock.pointPortions,
    supplyingWarehousePortions: stock.supplyingWarehousePortions,
    inboundTransfers: stock.inboundTransfers.map((transfer) => ({
      status: transfer.status,
    })),
  };

  const proposal = NoRestockToday.propose({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: RIBS_ID,
    coverage: stock,
  });

  expect(proposal).toMatchObject({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: RIBS_ID,
    actorId: null,
    serviceDate: null,
  });
  expect(proposal?.statusAt(BEFORE_MIDNIGHT)).toBe("proposed");
  expect(stock).toEqual(before);
  expect(proposal).not.toHaveProperty("movements");
});

it("given no portions and no transfer on the way, when availability is evaluated, then a proposal is raised", () => {
  const proposal = propose(0, 0);

  expect(proposal?.statusAt(BEFORE_MIDNIGHT)).toBe("proposed");
});

it("given portions below 1 and a dispatched or in-transit transfer, when availability is evaluated, then no proposal is raised", () => {
  const dispatched = propose(0, 0, [{ status: "dispatched" }]);
  const inTransit = propose(0, 0.25, [
    { status: "received" },
    { status: "in_transit" },
  ]);

  expect(dispatched).toBeNull();
  expect(inTransit).toBeNull();
});

it("given the point or a supplying warehouse can cover one portion, when availability is evaluated, then no proposal is raised", () => {
  const pointCovers = propose(1, 0);
  const warehouseCovers = propose(0, 1);

  expect(pointCovers).toBeNull();
  expect(warehouseCovers).toBeNull();
});

it("given a proposal and no actor, when confirm is attempted, then it is rejected and the mark stays proposed", () => {
  const proposal = propose(0, 0);
  const confirmWithoutActor = () => {
    proposal?.confirm({ actorId: null, at: BEFORE_MIDNIGHT });
  };
  const confirmWithBlankActor = () => {
    proposal?.confirm({ actorId: "   ", at: BEFORE_MIDNIGHT });
  };

  expect(confirmWithoutActor).toThrow(MissingActor);
  expect(confirmWithBlankActor).toThrow(MissingActor);
  expect(proposal?.statusAt(BEFORE_MIDNIGHT)).toBe("proposed");
  expect(proposal?.statusAt(AFTER_MIDNIGHT)).toBe("proposed");
  expect(proposal?.actorId).toBeNull();
  expect(proposal?.serviceDate).toBeNull();
});

it("given a confirmed mark and a service still open after midnight, when the Bogota date changes, then the mark reads expired", () => {
  const proposal = propose(0, 0);

  proposal?.confirm({ actorId: KITCHEN_CHIEF_ID, at: BEFORE_MIDNIGHT });

  expect(proposal?.statusAt(BEFORE_MIDNIGHT)).toBe("confirmed");
  expect(proposal?.actorId).toBe(KITCHEN_CHIEF_ID);
  expect(proposal?.serviceDate).toBe("2026-11-13");
  expect(proposal?.statusAt(AFTER_MIDNIGHT)).toBe("expired");
});

it("given a confirmed mark and no actor, when removal is attempted, then it is rejected", () => {
  const proposal = propose(0, 0);
  proposal?.confirm({ actorId: KITCHEN_CHIEF_ID, at: BEFORE_MIDNIGHT });
  const remove = () => {
    proposal?.remove({ actorId: "" });
  };

  expect(remove).toThrow(MissingActor);
  expect(proposal?.statusAt(BEFORE_MIDNIGHT)).toBe("confirmed");
});

it("given a confirmed mark, when an identified person removes it, then it stays removed after midnight", () => {
  const proposal = propose(0, 0);
  proposal?.confirm({ actorId: KITCHEN_CHIEF_ID, at: BEFORE_MIDNIGHT });

  proposal?.remove({ actorId: "user_site_admin" });

  expect(proposal?.statusAt(BEFORE_MIDNIGHT)).toBe("removed");
  expect(proposal?.statusAt(AFTER_MIDNIGHT)).toBe("removed");
});
