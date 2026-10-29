import type { StationRouter } from "#domain/station-router.js";

export abstract class StationDirectory {
  abstract load(
    tenantId: string,
    venueId: string,
  ): Promise<StationRouter | null>;
}
