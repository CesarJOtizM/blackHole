import {
  NoRestockProposalStore,
  PortionSupply,
  ProposeNoRestockToday,
  type ProposeNoRestockTodayInput,
} from "@blackhole/inventory/application/entry-port";
import type { ProducibleQuantityRepository } from "@blackhole/inventory/application/ports/producible-quantity-repository";
import type { NoRestockToday } from "@blackhole/inventory/domain";

import {
  type InboundTransferReader,
  noInboundTransfers,
} from "#src/composition/inbound-transfers.js";

export class ProjectedPortionSupply extends PortionSupply {
  constructor(
    private readonly projections: ProducibleQuantityRepository,
    private readonly inbound: InboundTransferReader = noInboundTransfers,
  ) {
    super();
  }

  override async read(query: {
    tenantId: string;
    venueId: string;
    productId: string;
  }) {
    const [stored, inboundTransfers] = await Promise.all([
      this.projections.find(query.tenantId, query.venueId, {
        productId: query.productId,
        variantId: null,
      }),
      this.inbound.statuses(query.tenantId, query.venueId),
    ]);

    if (stored === null) {
      return {
        pointPortions: 0,
        supplyingWarehousePortions: 0,
        inboundTransfers,
      };
    }

    return {
      pointPortions: stored.pointUnits,
      supplyingWarehousePortions: Math.max(
        stored.replenishmentUnits - stored.pointUnits,
        0,
      ),
      inboundTransfers,
    };
  }
}

export class MarksProposalStore extends NoRestockProposalStore {
  constructor(
    private readonly marks: { save(mark: NoRestockToday): Promise<void> },
  ) {
    super();
  }

  override save(proposal: NoRestockToday): Promise<void> {
    return this.marks.save(proposal);
  }
}

export class CloudNoRestockProposal {
  constructor(
    private readonly enabled: boolean,
    private readonly propose: ProposeNoRestockToday,
  ) {}

  async afterProduct(input: ProposeNoRestockTodayInput): Promise<void> {
    if (!this.enabled) {
      return;
    }

    await this.propose.execute(input);
  }
}

export const proposeUncoveredProducts = async (
  enabled: boolean,
  marks: { save(mark: NoRestockToday): Promise<void> } | null,
  projections: ProducibleQuantityRepository,
  inbound: InboundTransferReader = noInboundTransfers,
  input: {
    kind: string;
    tenantId: string;
    siteId: string;
    productId?: string;
    ingredientId?: string;
  },
): Promise<void> => {
  if (!enabled || marks === null) {
    return;
  }

  const products =
    input.kind === "recipe" && input.productId !== undefined
      ? [{ productId: input.productId }]
      : input.ingredientId === undefined
        ? []
        : await projections.productsFor(
            input.tenantId,
            input.siteId,
            input.ingredientId,
          );
  const proposal = new CloudNoRestockProposal(
    true,
    new ProposeNoRestockToday(
      new ProjectedPortionSupply(projections, inbound),
      new MarksProposalStore(marks),
      true,
    ),
  );

  for (const product of products) {
    await proposal.afterProduct({
      tenantId: input.tenantId,
      venueId: input.siteId,
      productId: product.productId,
      at: new Date(),
    });
  }
};
