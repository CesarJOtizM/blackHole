import type { PortionSupply } from "#application/ports/portion-supply.js";
import { NoRestockToday } from "#domain/no-restock-today.js";

const BOGOTA_TIME_ZONE = "America/Bogota";

export abstract class NoRestockProposalStore {
  abstract save(proposal: NoRestockToday): Promise<void>;
}

export interface ProposeNoRestockTodayInput {
  tenantId: string;
  venueId: string;
  productId: string;
  at: Date;
}

export interface ProposeNoRestockTodayResult {
  today: string;
  proposal: NoRestockToday | null;
}

const bogotaCalendarDate = (instant: Date): string => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
};

export class ProposeNoRestockToday {
  constructor(
    private readonly portions: PortionSupply,
    private readonly proposals: NoRestockProposalStore,
    private readonly noRestockTodayEnabled: boolean,
  ) {}

  async execute(
    input: ProposeNoRestockTodayInput,
  ): Promise<ProposeNoRestockTodayResult> {
    const today = bogotaCalendarDate(input.at);

    if (!this.noRestockTodayEnabled) {
      return { today, proposal: null };
    }

    const coverage = await this.portions.read({
      tenantId: input.tenantId,
      venueId: input.venueId,
      productId: input.productId,
    });
    const proposal = NoRestockToday.propose({
      tenantId: input.tenantId,
      venueId: input.venueId,
      productId: input.productId,
      coverage,
    });

    if (proposal === null) {
      return { today, proposal: null };
    }

    await this.proposals.save(proposal);

    return { today, proposal };
  }
}
