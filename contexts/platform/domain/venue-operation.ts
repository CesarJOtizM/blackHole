const OPERATING_MODE = {
  CLOUD: "cloud",
} as const;

const OPERATION_OWNER = {
  CLOUD: "cloud",
} as const;

const INITIAL_CLOUD_GENERATION = 1;

export type OperatingMode =
  (typeof OPERATING_MODE)[keyof typeof OPERATING_MODE];

export type OperationOwner =
  (typeof OPERATION_OWNER)[keyof typeof OPERATION_OWNER];

export class StaleGeneration extends Error {
  constructor() {
    super(
      "The write generation does not match the current operation generation.",
    );
    this.name = "StaleGeneration";
  }
}

export class VenueOperation {
  readonly venueId: string;
  readonly mode: OperatingMode;
  readonly operationOwner: OperationOwner;
  readonly generation: number;

  private constructor(venueId: string) {
    this.venueId = venueId;
    this.mode = OPERATING_MODE.CLOUD;
    this.operationOwner = OPERATION_OWNER.CLOUD;
    this.generation = INITIAL_CLOUD_GENERATION;
  }

  static openCloud(venueId: string): VenueOperation {
    return new VenueOperation(venueId);
  }

  acceptWrite(generation: number): void {
    if (generation !== this.generation) {
      throw new StaleGeneration();
    }
  }
}
