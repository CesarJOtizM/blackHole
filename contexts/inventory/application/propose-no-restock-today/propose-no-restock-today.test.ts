import { expect, it } from "vitest";

import type { PortionSupplyQuery } from "#application/ports/portion-supply.js";
import { PortionSupply } from "#application/ports/portion-supply.js";
import {
  NoRestockProposalStore,
  ProposeNoRestockToday,
} from "#application/propose-no-restock-today/propose-no-restock-today.js";
import type {
  NoRestockToday,
  PortionCoverage,
} from "#domain/no-restock-today.js";

const TENANT_ID = "organization_tenant_1";
const VENUE_ID = "venue_site_1";
const RIBS_ID = "product_ribs";
const BEFORE_MIDNIGHT = new Date("2026-11-14T04:59:00.000Z");
const AFTER_MIDNIGHT = new Date("2026-11-14T05:01:00.000Z");

const coverageOf = (
  pointPortions: number,
  supplyingWarehousePortions: number,
  inboundTransfers: readonly { status: string }[] = [],
): PortionCoverage => ({
  pointPortions,
  supplyingWarehousePortions,
  inboundTransfers,
});

const snapshot = (coverage: PortionCoverage) => ({
  pointPortions: coverage.pointPortions,
  supplyingWarehousePortions: coverage.supplyingWarehousePortions,
  inboundTransfers: coverage.inboundTransfers.map((transfer) => ({
    status: transfer.status,
  })),
});

class FixedPortions extends PortionSupply {
  readonly reads: PortionSupplyQuery[] = [];

  constructor(private readonly coverage: PortionCoverage) {
    super();
  }

  override async read(query: PortionSupplyQuery): Promise<PortionCoverage> {
    this.reads.push(query);
    return this.coverage;
  }
}

class MemoryProposals extends NoRestockProposalStore {
  readonly saved: NoRestockToday[] = [];

  override async save(proposal: NoRestockToday): Promise<void> {
    this.saved.push(proposal);
  }
}

const sentLines = () => [
  { id: "line_table_4", productId: RIBS_ID, state: "sent" },
];

const harness = (
  enabled: boolean,
  pointPortions: number,
  supplyingWarehousePortions: number,
  inboundTransfers: readonly { status: string }[] = [],
) => {
  const coverage = coverageOf(
    pointPortions,
    supplyingWarehousePortions,
    inboundTransfers,
  );
  const portions = new FixedPortions(coverage);
  const proposals = new MemoryProposals();
  const lines = sentLines();
  const useCase = new ProposeNoRestockToday(portions, proposals, enabled);

  return {
    coverage,
    before: snapshot(coverage),
    portions,
    proposals,
    lines,
    linesBefore: lines.map((line) => ({ ...line })),
    useCase,
  };
};

const command = (at: Date) => ({
  tenantId: TENANT_ID,
  venueId: VENUE_ID,
  productId: RIBS_ID,
  at,
});

it("given the flag is off and portions are below 1, when availability is evaluated after midnight, then nothing is written", async () => {
  const { coverage, before, portions, proposals, lines, linesBefore, useCase } =
    harness(false, 0, 0);

  const result = await useCase.execute(command(AFTER_MIDNIGHT));

  expect(result.proposal).toBeNull();
  expect(result.today).toBe("2026-11-14");
  expect(portions.reads).toEqual([]);
  expect(proposals.saved).toEqual([]);
  expect(coverage).toEqual(before);
  expect(lines).toEqual(linesBefore);
});

it("given covered stock, when availability is evaluated, then nothing is written", async () => {
  const pointCovers = harness(true, 1, 0);
  const warehouseCovers = harness(true, 0, 1);

  const pointResult = await pointCovers.useCase.execute(
    command(BEFORE_MIDNIGHT),
  );
  const warehouseResult = await warehouseCovers.useCase.execute(
    command(BEFORE_MIDNIGHT),
  );

  expect(pointResult.proposal).toBeNull();
  expect(warehouseResult.proposal).toBeNull();
  expect(pointCovers.proposals.saved).toEqual([]);
  expect(warehouseCovers.proposals.saved).toEqual([]);
  expect(pointCovers.coverage).toEqual(pointCovers.before);
  expect(warehouseCovers.coverage).toEqual(warehouseCovers.before);
  expect(pointCovers.lines).toEqual(pointCovers.linesBefore);
  expect(warehouseCovers.lines).toEqual(warehouseCovers.linesBefore);
});

it("given portions below 1 and a dispatched or in-transit transfer, when availability is evaluated, then nothing is written", async () => {
  const dispatched = harness(true, 0, 0, [{ status: "dispatched" }]);
  const inTransit = harness(true, 0, 0.25, [
    { status: "received" },
    { status: "in_transit" },
  ]);

  const dispatchedResult = await dispatched.useCase.execute(
    command(BEFORE_MIDNIGHT),
  );
  const inTransitResult = await inTransit.useCase.execute(
    command(AFTER_MIDNIGHT),
  );

  expect(dispatchedResult.proposal).toBeNull();
  expect(inTransitResult.proposal).toBeNull();
  expect(dispatched.proposals.saved).toEqual([]);
  expect(inTransit.proposals.saved).toEqual([]);
  expect(dispatched.coverage).toEqual(dispatched.before);
  expect(inTransit.coverage).toEqual(inTransit.before);
  expect(inTransitResult.today).toBe("2026-11-14");
  expect(dispatched.lines).toEqual(dispatched.linesBefore);
  expect(inTransit.lines).toEqual(inTransit.linesBefore);
});

it("given portions below 1 and a transfer that is not dispatched or in transit, when availability is evaluated, then a proposal is saved and stock and order lines stay unchanged", async () => {
  const beforeMidnight = harness(true, 0, 0.25, [
    { status: "requested" },
    { status: "received" },
  ]);
  const afterMidnight = harness(true, 0, 0);

  const beforeResult = await beforeMidnight.useCase.execute(
    command(BEFORE_MIDNIGHT),
  );
  const afterResult = await afterMidnight.useCase.execute(
    command(AFTER_MIDNIGHT),
  );

  expect(beforeResult.today).toBe("2026-11-13");
  expect(afterResult.today).toBe("2026-11-14");
  expect(beforeResult.proposal).toMatchObject({
    tenantId: TENANT_ID,
    venueId: VENUE_ID,
    productId: RIBS_ID,
    actorId: null,
    serviceDate: null,
  });
  expect(afterResult.proposal?.statusAt(AFTER_MIDNIGHT)).toBe("proposed");
  expect(beforeResult.proposal?.statusAt(BEFORE_MIDNIGHT)).toBe("proposed");
  expect(beforeResult.proposal?.statusAt(AFTER_MIDNIGHT)).toBe("proposed");
  expect(beforeMidnight.proposals.saved).toEqual([beforeResult.proposal]);
  expect(afterMidnight.proposals.saved).toEqual([afterResult.proposal]);
  expect(beforeResult.proposal).not.toHaveProperty("movements");
  expect(afterResult.proposal).not.toHaveProperty("closesAt");
  expect(beforeMidnight.coverage).toEqual(beforeMidnight.before);
  expect(afterMidnight.coverage).toEqual(afterMidnight.before);
  expect(beforeMidnight.lines).toEqual(beforeMidnight.linesBefore);
  expect(afterMidnight.lines).toEqual(afterMidnight.linesBefore);
  expect(beforeMidnight.lines[0]?.state).toBe("sent");
});
