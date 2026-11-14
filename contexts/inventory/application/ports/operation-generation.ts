export abstract class OperationGeneration {
  abstract assertCurrent(
    tenantId: string,
    venueId: string,
    generation: number,
  ): Promise<void>;
}
