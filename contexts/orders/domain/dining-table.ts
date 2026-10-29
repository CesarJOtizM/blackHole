const TABLE_ID_PREFIX = "table_";

const TABLE_STATE = {
  FREE: "free",
  OCCUPIED: "occupied",
  CHECK_REQUESTED: "check_requested",
  TO_CLEAN: "to_clean",
} as const;

export type TableState = (typeof TABLE_STATE)[keyof typeof TABLE_STATE];

interface PlaceTable {
  id: string;
  tenantId: string;
  venueId: string;
  zone: string;
}

interface OpenTable {
  diners: number;
}

export class InvalidTableId extends Error {
  constructor() {
    super("A table identifier must use the table_ prefix.");
    this.name = "InvalidTableId";
  }
}

export class TableAlreadyOccupied extends Error {
  constructor() {
    super("The table is already occupied.");
    this.name = "TableAlreadyOccupied";
  }
}

function assertTableId(id: string): void {
  if (!id.startsWith(TABLE_ID_PREFIX) || id.length === TABLE_ID_PREFIX.length) {
    throw new InvalidTableId();
  }
}

export class DiningTable {
  readonly id: string;
  readonly tenantId: string;
  readonly venueId: string;
  readonly zone: string;

  private tableState: TableState = TABLE_STATE.FREE;
  private dinerCount = 0;

  private constructor(input: PlaceTable) {
    this.id = input.id;
    this.tenantId = input.tenantId;
    this.venueId = input.venueId;
    this.zone = input.zone;
  }

  static place(input: PlaceTable): DiningTable {
    assertTableId(input.id);

    return new DiningTable(input);
  }

  get state(): TableState {
    return this.tableState;
  }

  get diners(): number {
    return this.dinerCount;
  }

  open(input: OpenTable): void {
    if (this.tableState !== TABLE_STATE.FREE) {
      throw new TableAlreadyOccupied();
    }

    this.dinerCount = input.diners;
    this.tableState = TABLE_STATE.OCCUPIED;
  }

  requestCheck(): void {
    if (this.tableState !== TABLE_STATE.OCCUPIED) {
      throw new TableAlreadyOccupied();
    }

    this.tableState = TABLE_STATE.CHECK_REQUESTED;
  }

  release(): void {
    if (
      this.tableState !== TABLE_STATE.OCCUPIED &&
      this.tableState !== TABLE_STATE.CHECK_REQUESTED
    ) {
      throw new TableAlreadyOccupied();
    }

    this.tableState = TABLE_STATE.TO_CLEAN;
  }

  markReady(): void {
    if (this.tableState !== TABLE_STATE.TO_CLEAN) {
      throw new TableAlreadyOccupied();
    }

    this.dinerCount = 0;
    this.tableState = TABLE_STATE.FREE;
  }
}
